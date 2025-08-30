// Simple email service using EmailJS (free tier)
// You can replace this with any email service like Resend, SendGrid, etc.

export const sendChildLoginEmail = async (
    childEmail: string, 
    childName: string, 
    password: string,
    parentName: string
  ) => {
    // For now, we'll just log it (you can integrate a real email service later)
    console.log('Email would be sent:', {
      to: childEmail,
      subject: 'Your Family Tasks Account is Ready! 🎉',
      content: `
        Hi ${childName}!
  
        Your parent (${parentName}) has created a Family Tasks account for you.
  
        Here are your login details:
        Email: ${childEmail}
        Password: ${password}
  
        You can now sign in at the Family Tasks app to see your tasks and earn points!
  
        Have fun completing tasks and earning rewards!
        
        - Family Tasks Team
      `
    })
  
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // For MVP, we'll just return success
    // Later you can integrate with real email services:
    /*
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: childEmail,
        subject: 'Your Family Tasks Account is Ready! 🎉',
        childName,
        password,
        parentName
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to send email')
    }
    */
    
    return { success: true }
  }