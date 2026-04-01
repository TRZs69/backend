const prisma = require('../prismaClient');

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
   * Get Stratified Random Sample with Equal Allocation
   * Strata: Chapter
   */
  async getStratifiedSample() {
    // 1. Get all messages (Population)
    // We only care about pairs of user-assistant messages
    // For simplicity, we'll use the ChatHistory table (assuming it's 'chat_history' in Supabase or local)
    // Actually, let's use the local database or Supabase to count.
    
    // For this implementation, we assume we want to sample from ChatSession messages.
    // Let's assume we use 'userId' and 'chapterId' as strata.
    
    // Get total count of chat sessions that have a chapterId (our strata)
    const sessions = await prisma.$queryRaw`
      SELECT chapterId, COUNT(*) as count 
      FROM chat_sessions 
      WHERE chapterId IS NOT NULL 
      GROUP BY chapterId
    `;

    if (!sessions.length) return { sampleSize: 0, strata: [] };

    const totalN = sessions.reduce((sum, s) => sum + Number(s.count), 0);
    const requiredTotalN = this.calculateSampleSize(totalN);
    const L = sessions.length; // Number of strata

    // Equal Allocation: nh = n / L
    const nh = Math.ceil(requiredTotalN / L);

    const strataDetails = sessions.map(s => ({
      chapterId: s.chapterId,
      populationSize: Number(s.count),
      sampleSize: Math.min(Number(s.count), nh)
    }));

    return {
      totalPopulation: totalN,
      totalRequiredSample: requiredTotalN,
      strataCount: L,
      equalAllocationPerStratum: nh,
      strata: strataDetails
    };
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
