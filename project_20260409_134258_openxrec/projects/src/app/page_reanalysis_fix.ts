// 临时文件 - 用于标记修改位置
// 需要在 page.tsx 中添加 handleReanalysis 函数并传递给 ChatPanel

/*
在 handleAddRelation 函数后添加:

  // 处理重新分析（从 ChatPanel 触发）
  const handleReanalysis = useCallback((targetNode: string) => {
    console.log(`[重新分析] 触发节点: ${targetNode}`);
    recordInteraction('reanalysis', { targetNode, topic });
    handleAnalyze(topic);
  }, [topic, recordInteraction, handleAnalyze]);

在 ChatPanel 组件中添加 onReanalysis 属性:

  <ChatPanel 
    analysisContext={{...}}
    onReanalysis={handleReanalysis}
  />
*/
