const prisma = require('../prismaClient');
const supabase = require('../../supabase/supabase');

class SamplingService {
  constructor() {
    this.Z = 1.96;
    this.p = 0.5;
    this.e = 0.10;
  }

  calculateSampleSize(N) {
    if (N <= 0) return 0;
    
    const n0 = (Math.pow(this.Z, 2) * this.p * (1 - this.p)) / Math.pow(this.e, 2);
    const n = n0 / (1 + (n0 - 1) / N);
    
    return Math.ceil(n);
  }

  async getTotalPopulationCount() {
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

  async getUserSamplePlan() {
    const N = await this.getTotalPopulationCount();
    const U = await this.getTotalUserCount();
    
    if (N === 0 || U === 0) {
      return { totalPopulation: N, totalRequiredSample: 0, userCount: U, samplesPerUser: 0 };
    }

    const n = this.calculateSampleSize(N);

    const samplesPerUser = Math.ceil(n / U);

    return {
      totalPopulation: N,
      totalRequiredSample: n,
      userCount: U,
      samplesPerUser: samplesPerUser
    };
  }

  async getStratifiedSample() {
  }

  async getMessagesForRating(userId) {
    const samplingPlan = await this.getStratifiedSample();
    const resultMessages = [];

    for (const stratum of samplingPlan.strata) {
      const sessions = await prisma.chatSession.findMany({
        where: { 
          chapterId: stratum.chapterId,
        },
        take: stratum.sampleSize,
        orderBy: { createdAt: 'desc' }, 
        include: {
        }
      });
      resultMessages.push(...sessions);
    }

    return {
      plan: samplingPlan,
      sessions: resultMessages
    };
  }
}

module.exports = new SamplingService();
