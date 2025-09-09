'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Filter, X, Calendar, User, CheckSquare, Repeat, Clock } from 'lucide-react'
import { TaskFilters as TaskFiltersType } from '@/types'

interface Child {
  id: string
  name: string
}

interface TaskFiltersProps {
  filters: TaskFiltersType
  onFiltersChange: (filters: Partial<TaskFiltersType>) => void
  onClearFilters: () => void
  children?: Child[] // Only for parents
  isParent?: boolean
  stats?: {
    active: number
    pending: number
    inProgress: number
    completed: number
    approved: number
    rejected: number
    archived: number
    overdue: number
  }
}

export default function TaskFilters({
  filters,
  onFiltersChange,
  onClearFilters,
  children = [],
  isParent = false,
  stats
}: TaskFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const statusOptions = [
    { value: 'all', label: 'All Tasks', count: stats ? stats.pending + stats.inProgress + stats.completed + stats.approved + stats.rejected : 0 },
    { value: 'active', label: 'Active Tasks', count: stats?.active }, // Make this clearer
    { value: 'pending', label: 'Pending', count: stats?.pending },
    { value: 'in_progress', label: 'In Progress', count: stats?.inProgress },
    { value: 'completed', label: 'Need Review', count: stats?.completed }, // Make this clearer
    { value: 'approved', label: 'Approved', count: stats?.approved },
    { value: 'rejected', label: 'Rejected', count: stats?.rejected }
  ]

  const dueDateOptions = [
    { value: 'all', label: 'All Due Dates' },
    { value: 'overdue', label: 'Overdue', count: stats?.overdue },
    { value: 'today', label: 'Due Today' },
    { value: 'thisWeek', label: 'Due This Week' },
    { value: 'noDueDate', label: 'No Due Date' }
  ]

  const hasActiveFilters = 
    filters.status !== 'active' || 
    filters.dueDate !== 'all' || 
    (isParent && filters.assignedTo !== 'all') ||
    filters.showArchived ||
    filters.taskType !== 'all' ||
    (filters.taskType === 'recurring' && filters.recurringPattern !== 'all')

  const getActiveFiltersCount = () => {
    let count = 0
    if (filters.status !== 'active') count++
    if (filters.dueDate !== 'all') count++
    if (isParent && filters.assignedTo !== 'all') count++
    if (filters.showArchived) count++
    if (filters.taskType !== 'all') count++
    if (filters.taskType === 'recurring' && filters.recurringPattern !== 'all') count++
    return count
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Filter className="w-4 h-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFiltersCount()}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={onClearFilters}
                className="h-8"
              >
                <X className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setIsExpanded(!isExpanded)}
              className="md:hidden"
            >
              {isExpanded ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className={`space-y-4 ${!isExpanded ? 'hidden md:block' : ''}`}>
        
        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center">
            <CheckSquare className="w-3 h-3 mr-1" />
            Status
          </label>
          <Select 
            value={filters.status} 
            onValueChange={(value) => onFiltersChange({ status: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex justify-between items-center w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && (
                      <Badge variant="outline" className="ml-2">
                        {option.count}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Due Date Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center">
            <Calendar className="w-3 h-3 mr-1" />
            Due Date
          </label>
          <Select 
            value={filters.dueDate} 
            onValueChange={(value) => onFiltersChange({ dueDate: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dueDateOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex justify-between items-center w-full">
                    <span>{option.label}</span>
                    {option.count !== undefined && option.count > 0 && (
                      <Badge variant="outline" className="ml-2">
                        {option.count}
                      </Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Task Type Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium flex items-center">
            <Repeat className="w-3 h-3 mr-1" />
            Task Type
          </label>
          <Select 
            value={filters.taskType} 
            onValueChange={(value: 'all' | 'recurring' | 'one-time') => onFiltersChange({ taskType: value, recurringPattern: 'all' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tasks</SelectItem>
              <SelectItem value="recurring">🔄 Recurring Tasks</SelectItem>
              <SelectItem value="one-time">📅 One-Time Tasks</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Recurring Pattern Filter (only when recurring is selected) */}
        {filters.taskType === 'recurring' && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              Recurring Pattern
            </label>
            <Select 
              value={filters.recurringPattern} 
              onValueChange={(value: 'all' | 'daily' | 'weekly' | 'monthly') => onFiltersChange({ recurringPattern: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Patterns</SelectItem>
                <SelectItem value="daily">📆 Daily</SelectItem>
                <SelectItem value="weekly">📅 Weekly</SelectItem>
                <SelectItem value="monthly">🗓️ Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Child Filter (Parents Only) */}
        {isParent && children.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center">
              <User className="w-3 h-3 mr-1" />
              Assigned Child
            </label>
            <Select 
              value={filters.assignedTo} 
              onValueChange={(value) => onFiltersChange({ assignedTo: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Children</SelectItem>
                {children.map((child) => (
                  <SelectItem key={child.id} value={child.id}>
                    {child.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Show Archived Toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Show Archived Tasks</label>
          <Button
            size="sm"
            variant={filters.showArchived ? "default" : "outline"}
            onClick={() => onFiltersChange({ showArchived: !filters.showArchived })}
          >
            {filters.showArchived ? 'Hide' : 'Show'} Archived
            {stats?.archived > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.archived}
              </Badge>
            )}
          </Button>
        </div>

        {/* Quick Filters */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Quick Filters</label>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={filters.status === 'pending' ? "default" : "outline"}
              onClick={() => onFiltersChange({ status: 'pending' })}
            >
              Pending {stats?.pending > 0 && `(${stats.pending})`}
            </Button>
            <Button
              size="sm"
              variant={filters.dueDate === 'overdue' ? "default" : "outline"}
              onClick={() => onFiltersChange({ dueDate: 'overdue' })}
            >
              Overdue {stats?.overdue > 0 && `(${stats.overdue})`}
            </Button>
            <Button
              size="sm"
              variant={filters.status === 'completed' ? "default" : "outline"}
              onClick={() => onFiltersChange({ status: 'completed' })}
            >
              Need Review {stats?.completed > 0 && `(${stats.completed})`}
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  )
}