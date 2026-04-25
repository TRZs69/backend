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
    const chapters = await prisma.chapter.findMany({
      select: { id: true, name: true }
    });

    const N = await this.getTotalPopulationCount();
    const n = this.calculateSampleSize(N);

    if (N === 0) {
      return { totalPopulation: 0, totalRequiredSample: 0, strata: [] };
    }

    const strata = [];
    let totalAllocated = 0;

    for (const chapter of chapters) {
      const { count, error } = await supabase
        .from('chat_messages')
        .select('id, chat_sessions!inner(metadata)', { count: 'exact', head: true })
        .eq('role', 'assistant')
        .eq('chat_sessions.metadata->>chapterId', chapter.id.toString());

      if (error) {
        console.error(`Error counting messages for chapter ${chapter.id}:`, error.message);
        continue;
      }

      const Ni = count || 0;
      if (Ni === 0) continue;

      const ni = Math.round((Ni / N) * n);
      
      strata.push({
        chapterId: chapter.id,
        chapterName: chapter.name,
        populationSize: Ni,
        sampleSize: ni,
        proportion: Ni / N
      });
      
      totalAllocated += ni;
    }

    if (strata.length > 0 && totalAllocated !== n) {
      const diff = n - totalAllocated;
      const largestStrata = strata.reduce((prev, current) => 
        (prev.populationSize > current.populationSize) ? prev : current
      );
      largestStrata.sampleSize += diff;
    }

    return {
      totalPopulation: N,
      totalRequiredSample: n,
      strata: strata
    };
  }

  async getMessagesForRating(userId) {
    const samplingPlan = await this.getStratifiedSample();
    const resultMessages = [];

    for (const stratum of samplingPlan.strata) {
      if (stratum.sampleSize <= 0) continue;

      const { data, error } = await supabase
        .from('chat_messages')
        .select(`
          id,
          content,
          role,
          created_at,
          session_id,
          chat_sessions!inner(user_id, metadata)
        `)
        .eq('role', 'assistant')
        .eq('chat_sessions.metadata->>chapterId', stratum.chapterId.toString())
        .limit(stratum.sampleSize);

      if (error) {
        console.error(`Error fetching messages for chapter ${stratum.chapterId}:`, error.message);
        continue;
      }

      if (data) {
        for (const msg of data) {
          const { data: prevMessages, error: prevError } = await supabase
            .from('chat_messages')
            .select('content')
            .eq('session_id', msg.session_id)
            .lt('created_at', msg.created_at)
            .eq('role', 'user')
            .order('created_at', { ascending: false })
            .limit(1);

          if (!prevError && prevMessages && prevMessages.length > 0) {
            resultMessages.push({
              messageId: msg.id,
              userRequest: prevMessages[0].content,
              botResponse: msg.content,
              chapterId: stratum.chapterId,
              chapterName: stratum.chapterName,
              createdAt: msg.created_at
            });
          }
        }
      }
    }

    return {
      plan: samplingPlan,
      messages: resultMessages
    };
  }
}

module.exports = new SamplingService();
