const axios = require('axios');

async function testUpdate() {
  try {
    const resGet = await axios.get('https://backend-render-proxy.onrender.com/api/chapter/137/materials');
    console.log("Current material ID:", resGet.data.id);
    console.log("Current material content prefix:", resGet.data.content.substring(0, 50));

    const materialId = resGet.data.id;
    const updatePayload = {
      chapterId: 137,
      name: resGet.data.name,
      content: resGet.data.content + " <!-- TEST UPDATE -->"
    };

    console.log("Sending PUT request to update material...");
    const resPut = await axios.put(`https://backend-render-proxy.onrender.com/api/material/${materialId}`, updatePayload);
    console.log("PUT status:", resPut.status);
    console.log("PUT response:", resPut.data);

  } catch (err) {
    console.error("Error:", err.response ? err.response.data : err.message);
  }
}

testUpdate();