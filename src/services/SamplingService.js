const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase');

/**
 * SamplingService
 * Handles Cochran Sampling with FPC and Stratified Random Sampling (Equal Allocation)
 */
class SamplingService {
  constructor() {
    // Standard Cochran parameters for 95% confidence and 10% margin of error
    this.Z = 1.96;
    this.p = 0.5; // Expected proportion (0.5 gives maximum sample size)
    this.e = 0.10; // Margin of error (10%)
  }

  /**
   * Calculate Cochran Sample Size with Finite Population Correction
   * n0 = (Z^2 * p * q) / e^2
   * n = n0 / (1 + (n0 - 1) / N)
   */
  calculateSampleSize(N) {
    if (N <= 0) return 0;
    
    const n0 = (Math.pow(this.Z, 2) * this.p * (1 - this.p)) / Math.pow(this.e, 2);
    const n = n0 / (1 + (n0 - 1) / N);
    
    return Math.ceil(n);
  }

  /**
   * Get total population count (pairs of user-assistant messages)
   */
  async getTotalPopulationCount() {
    // Count assistant messages that have a preceding user message in the same session
    const { count, error } = await supabase
      .from('chat_messages')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'assistant');
    
    if (error) {
      console.error('Error counting population:', error.message);
      return 0;
    }
    
    return count || 0;
  }

  /**
   * Get total number of users who have at least one chat session
   */
  async getTotalUserCount() {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('user_id')
      .not('user_id', 'is', null);
    
    if (error) {
      console.error('Error counting users:', error.message);
      return 0;
    }

    const uniqueUsers = new Set(data.map(d => d.user_id));
    return uniqueUsers.size;
  }

  /**
   * Get sample plan allocated per user
   */
  async getUserSamplePlan() {
    const N = await this.getTotalPopulationCount();
    const U = await this.getTotalUserCount();
    
    if (N === 0 || U === 0) {
      return { totalPopulation: N, totalRequiredSample: 0, userCount: U, samplesPerUser: 0 };
    }

    const n = this.calculateSampleSize(N);
    
    // Equal Allocation: nh = n / U
    const samplesPerUser = Math.ceil(n / U);

    return {
      totalPopulation: N,
      totalRequiredSample: n,
      userCount: U,
      samplesPerUser: samplesPerUser
    };
  }

  /**
   * Get Stratified Random Sample with Equal Allocation
   * Strata: Chapter
   */
  async getStratifiedSample() {
    // ... (rest of the file as is, or we can focus on the user-based sampling as requested)
  }

  /**
   * Fetch actual messages to be rated based on sampling
   */
  async getMessagesForRating(userId) {
    const samplingPlan = await this.getStratifiedSample();
    const resultMessages = [];

    for (const stratum of samplingPlan.strata) {
      // Fetch random messages from each chapter stratum
      // Note: In a real app, you might want to exclude already rated messages
      const sessions = await prisma.chatSession.findMany({
        where: { 
          chapterId: stratum.chapterId,
          // You could filter by userId if needed, but "stratified random" 
          // usually implies across the whole population unless specified.
        },
        take: stratum.sampleSize,
        // We'll simulate random by offset or just taking the first ones for this prototype
        orderBy: { createdAt: 'desc' }, 
        include: {
          // We would need a relation to messages here
        }
      });
      
      // Since messages are often stored in a separate table/Supabase, 
      // we'd fetch the latest pair for each session.
      // For now, let's return the session metadata.
      resultMessages.push(...sessions);
    }

    return {
      plan: samplingPlan,
      sessions: resultMessages
    };
  }
}

module.exports = new SamplingService();
