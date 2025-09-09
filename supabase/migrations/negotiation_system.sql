-- Enhanced Negotiations System
-- This replaces and expands the existing task_negotiations table

-- Drop existing simple negotiations table if it exists
DROP TABLE IF EXISTS task_negotiations CASCADE;
DROP TABLE IF EXISTS task_transfers CASCADE;

-- Create comprehensive negotiations table
CREATE TABLE negotiations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    negotiation_type TEXT NOT NULL CHECK (negotiation_type IN ('sibling_transfer', 'parent_negotiation')),
    
    -- Parties involved
    initiator_id UUID NOT NULL REFERENCES users(id), -- Child who starts negotiation
    recipient_id UUID NOT NULL REFERENCES users(id), -- Sibling or Parent who receives offer
    
    -- Current offer details
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'withdrawn')),
    
    -- For sibling transfers
    points_offered_to_recipient INTEGER, -- How many points recipient gets
    points_kept_by_initiator INTEGER, -- How many points initiator keeps
    expires_at TIMESTAMP WITH TIME ZONE, -- When offer expires (sibling only)
    
    -- For parent negotiations
    requested_points INTEGER, -- New points child wants
    requested_due_date TIMESTAMP WITH TIME ZONE, -- New due date child wants
    requested_description TEXT, -- Modified task description child wants
    
    -- Message and response
    offer_message TEXT,
    response_message TEXT,
    
    -- Track original task assignee for proper point distribution
    original_task_assignee UUID REFERENCES users(id), -- Who originally had the task
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    responded_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure valid point splits for sibling transfers
    CONSTRAINT valid_point_split CHECK (
        (negotiation_type = 'parent_negotiation') OR 
        (points_offered_to_recipient > 0 AND points_kept_by_initiator >= 0)
    )
);

-- Create negotiation messages table for conversation history
CREATE TABLE negotiation_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    message_type TEXT NOT NULL CHECK (message_type IN ('offer', 'counter_offer', 'acceptance', 'rejection', 'withdrawal')),
    
    -- Offer details (for counter-offers)
    points_offered_to_recipient INTEGER,
    points_kept_by_initiator INTEGER,
    requested_points INTEGER,
    requested_due_date TIMESTAMP WITH TIME ZONE,
    requested_description TEXT,
    
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add negotiation-related fields to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS negotiation_status TEXT DEFAULT 'none' CHECK (negotiation_status IN ('none', 'being_negotiated', 'transferred')),
ADD COLUMN IF NOT EXISTS point_split JSONB, -- Store final point distribution: {"original_assignee": 7, "final_assignee": 3}
ADD COLUMN IF NOT EXISTS negotiation_history JSONB DEFAULT '[]'::jsonb; -- Track all negotiations on this task

-- Indexes for performance
CREATE INDEX idx_negotiations_task_id ON negotiations(task_id);
CREATE INDEX idx_negotiations_recipient_pending ON negotiations(recipient_id, status) WHERE status = 'pending';
CREATE INDEX idx_negotiations_initiator ON negotiations(initiator_id);
CREATE INDEX idx_negotiations_expires_at ON negotiations(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_negotiation_messages_negotiation_id ON negotiation_messages(negotiation_id);
CREATE INDEX idx_tasks_negotiation_status ON tasks(negotiation_status) WHERE negotiation_status != 'none';

-- Function to automatically expire sibling transfer negotiations
CREATE OR REPLACE FUNCTION expire_negotiations()
RETURNS void AS $$
BEGIN
    UPDATE negotiations 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND negotiation_type = 'sibling_transfer'
    AND expires_at IS NOT NULL 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get pending negotiations count for a user
CREATE OR REPLACE FUNCTION get_pending_negotiations_count(user_id UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)
        FROM negotiations 
        WHERE recipient_id = user_id 
        AND status = 'pending'
        AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql;

-- Function to handle task transfer completion
CREATE OR REPLACE FUNCTION complete_task_transfer(
    p_negotiation_id UUID,
    p_task_id UUID
)
RETURNS void AS $$
DECLARE
    negotiation_record negotiations%ROWTYPE;
    current_assignee UUID;
BEGIN
    -- Get the current task assignee before transfer
    SELECT assigned_to INTO current_assignee FROM tasks WHERE id = p_task_id;
    
    -- Get the negotiation details
    SELECT * INTO negotiation_record 
    FROM negotiations 
    WHERE id = p_negotiation_id;
    
    -- Update task assignment
    UPDATE tasks 
    SET assigned_to = negotiation_record.recipient_id,
        original_assignee = COALESCE(negotiation_record.original_task_assignee, current_assignee),
        negotiation_status = 'transferred',
        point_split = jsonb_build_object(
            'original_assignee', negotiation_record.points_kept_by_initiator,
            'final_assignee', negotiation_record.points_offered_to_recipient
        )
    WHERE id = p_task_id;
    
    -- Cancel all other pending negotiations for this task
    UPDATE negotiations 
    SET status = 'withdrawn'
    WHERE task_id = p_task_id 
    AND id != p_negotiation_id 
    AND status = 'pending';
END;
$$ LANGUAGE plpgsql;

-- RLS Policies for negotiations table
ALTER TABLE negotiations ENABLE ROW LEVEL SECURITY;

-- Users can see negotiations they are part of
CREATE POLICY "Users can view their negotiations" ON negotiations
FOR SELECT USING (
    initiator_id = auth.uid() OR recipient_id = auth.uid()
);

-- Users can create negotiations as initiators
CREATE POLICY "Users can create negotiations as initiators" ON negotiations
FOR INSERT WITH CHECK (initiator_id = auth.uid());

-- Users can update negotiations they are recipients of (to respond)
CREATE POLICY "Recipients can respond to negotiations" ON negotiations
FOR UPDATE USING (recipient_id = auth.uid());

-- Initiators can withdraw their offers
CREATE POLICY "Initiators can withdraw negotiations" ON negotiations
FOR UPDATE USING (initiator_id = auth.uid() AND status IN ('pending', 'withdrawn'));

-- RLS Policies for negotiation_messages table
ALTER TABLE negotiation_messages ENABLE ROW LEVEL SECURITY;

-- Users can see messages for negotiations they are part of
CREATE POLICY "Users can view negotiation messages" ON negotiation_messages
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM negotiations n 
        WHERE n.id = negotiation_id 
        AND (n.initiator_id = auth.uid() OR n.recipient_id = auth.uid())
    )
);

-- Users can create messages for negotiations they are part of
CREATE POLICY "Users can create negotiation messages" ON negotiation_messages
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM negotiations n 
        WHERE n.id = negotiation_id 
        AND (n.initiator_id = auth.uid() OR n.recipient_id = auth.uid())
    )
    AND sender_id = auth.uid()
);

-- Function to automatically distribute points when task is completed
CREATE OR REPLACE FUNCTION distribute_negotiated_points()
RETURNS TRIGGER AS $$
DECLARE
    original_assignee_id UUID;
    final_assignee_id UUID;
    original_points INTEGER;
    final_points INTEGER;
BEGIN
    -- Only process if task is being approved and has point split
    IF NEW.status = 'approved' AND OLD.status != 'approved' AND NEW.point_split IS NOT NULL THEN
        
        -- Extract point distribution
        original_points := (NEW.point_split->>'original_assignee')::INTEGER;
        final_points := (NEW.point_split->>'final_assignee')::INTEGER;
        
        -- Find the original assignee from negotiation history
        SELECT initiator_id INTO original_assignee_id
        FROM negotiations 
        WHERE task_id = NEW.id 
        AND status = 'accepted'
        ORDER BY created_at DESC 
        LIMIT 1;
        
        final_assignee_id := NEW.assigned_to;
        
        -- Award points to both parties
        IF original_assignee_id IS NOT NULL AND original_points > 0 THEN
            UPDATE users 
            SET points = points + original_points 
            WHERE id = original_assignee_id;
        END IF;
        
        IF final_points > 0 THEN
            UPDATE users 
            SET points = points + final_points 
            WHERE id = final_assignee_id;
        END IF;
        
        -- Reset negotiation status
        NEW.negotiation_status := 'none';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic point distribution
DROP TRIGGER IF EXISTS trigger_distribute_negotiated_points ON tasks;
CREATE TRIGGER trigger_distribute_negotiated_points
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION distribute_negotiated_points();

-- Create a view for easy negotiation querying
CREATE OR REPLACE VIEW negotiation_details AS
SELECT 
    n.*,
    i.name as initiator_name,
    i.role as initiator_role,
    r.name as recipient_name,
    r.role as recipient_role,
    t.title as task_title,
    t.points as original_task_points,
    t.due_date as original_due_date,
    t.description as original_description
FROM negotiations n
JOIN users i ON n.initiator_id = i.id
JOIN users r ON n.recipient_id = r.id  
JOIN tasks t ON n.task_id = t.id;