/**
 * 记忆系统集成测试
 * 
 * 测试内容：
 * 1. 会话创建和恢复
 * 2. 记忆存储和检索
 * 3. Agent状态持久化
 * 4. 端到端分析流程
 */

// 使用Node.js运行时环境变量
const COZE_API_KEY = process.env.COZE_API_KEY || '';
const COZE_API_BASE = process.env.COZE_API_BASE || 'https://api.coze.cn';

async function testMemorySystem() {
  console.log('🧠 开始测试记忆系统...\n');
  
  // 1. 测试会话管理
  console.log('📝 测试1: 会话管理');
  const sessionResponse = await fetch('http://localhost:5000/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'test-user', topic: '测试主题' })
  });
  
  const sessionData = await sessionResponse.json();
  console.log('✅ 会话创建:', sessionData.success ? '成功' : '失败');
  const sessionId = sessionData.data?.sessionId;
  
  // 2. 测试记忆存储
  console.log('\n📝 测试2: 记忆存储');
  const memoryResponse = await fetch('http://localhost:5000/api/memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'fact',
      content: '这是一条测试记忆，用于验证记忆系统功能',
      importance: 0.8,
      tags: ['test', 'demo']
    })
  });
  
  const memoryData = await memoryResponse.json();
  console.log('✅ 记忆存储:', memoryData.success ? '成功' : '失败');
  
  // 3. 测试记忆检索
  console.log('\n📝 测试3: 记忆检索');
  const searchResponse = await fetch('http://localhost:5000/api/memory?q=测试记忆');
  const searchData = await searchResponse.json();
  console.log('✅ 记忆检索:', searchData.success ? '成功' : '失败');
  console.log('   找到记忆数:', searchData.data?.length || 0);
  
  // 4. 测试带记忆的分析
  console.log('\n📝 测试4: 带记忆的分析流程');
  
  const analyzeResponse = await fetch('http://localhost:5000/api/analyze-memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '测试分析请求',
      sessionId
    })
  });
  
  if (!analyzeResponse.ok) {
    console.log('❌ 分析请求失败:', analyzeResponse.status);
    return;
  }
  
  // 读取SSE流
  const reader = analyzeResponse.body?.getReader();
  const decoder = new TextDecoder();
  let eventCount = 0;
  let memoryEvents = 0;
  
  console.log('   开始读取事件流...');
  
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    
    const text = decoder.decode(value, { stream: true });
    const lines = text.split('\n');
    
    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventCount++;
      }
      if (line.includes('"type":"recall"') || line.includes('"action":"recall"')) {
        memoryEvents++;
      }
    }
  }
  
  console.log('✅ 分析完成');
  console.log('   接收事件数:', eventCount);
  console.log('   记忆相关事件:', memoryEvents);
  
  // 5. 测试会话恢复
  console.log('\n📝 测试5: 会话恢复');
  const restoreResponse = await fetch(`http://localhost:5000/api/sessions?sessionId=${sessionId}`);
  const restoreData = await restoreResponse.json();
  
  if (restoreData.success && restoreData.data) {
    console.log('✅ 会话恢复成功');
    console.log('   消息数:', restoreData.data.messages?.length || 0);
  } else {
    console.log('❌ 会话恢复失败');
  }
  
  // 6. 测试记忆统计
  console.log('\n📝 测试6: 记忆统计');
  const statsResponse = await fetch('http://localhost:5000/api/memory');
  const statsData = await statsResponse.json();
  console.log('✅ 统计信息:', statsData.data);
  
  console.log('\n🎉 测试完成！');
}

// 运行测试
testMemorySystem().catch(console.error);
