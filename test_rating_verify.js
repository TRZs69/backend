require('dotenv').config();
const chatbotService = require('./src/services/ChatbotService');
const supabase = require('./supabase/supabase');

async function testRatingLogging() {
  console.log('--- Verifying chatbot_ratings_2 Model Logging ---');

  const originalFrom = supabase.from;
  let capturedRows = null;
  
  supabase.from = (table) => {
    if (table === 'chatbot_ratings_2') {
      return {
        insert: (rows) => {
          capturedRows = rows;
          return {
            select: () => ({ 
              data: rows.map((r, i) => ({ ...r, id: `rating-${i}`, created_at: new Date().toISOString() })), 
              error: null 
            })
          };
        }
      };
    }
    return originalFrom.apply(supabase, [table]);
  };

  try {
    const payload = {
      userId: 123,
      userRequest: 'Halo',
      botResponse: 'Halo! Saya Levely.',
      rating: 5,
      comment: 'Bagus!',
      model: 'gemma-4-pro'
    };

    await chatbotService.saveRating(payload);

    console.log('Rating row capture successful.');
    const ratingRow = capturedRows[0];
    
    if (ratingRow && ratingRow.model === 'gemma-4-pro') {
      console.log('✅ PASS: Table "chatbot_ratings_2" will receive model: ' + ratingRow.model);
    } else {
      console.log('❌ FAIL: Table "chatbot_ratings_2" model is missing or incorrect.');
      console.log('Captured row:', ratingRow);
    }
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    supabase.from = originalFrom;
  }
}

testRatingLogging();
