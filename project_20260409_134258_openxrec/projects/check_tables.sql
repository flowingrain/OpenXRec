-- 检查所有表是否已创建
-- 使用此脚本验证数据库表状态

-- 1. 从schema定义的表
SELECT 'Schema Tables' as category, 
       unnest(ARRAY[
         'ab_experiments',
         'health_check',
         'experiment_runs',
         'knowledge_patterns',
         'optimizations',
         'case_embeddings',
         'user_feedbacks',
         'analysis_cases',
         'kg_entities',
         'kg_relations',
         'kg_corrections',
         'kg_snapshots',
         'user_preferences',
         'report_versions',
         'knowledge_docs'
       ]) as table_name,
       CASE 
         WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = unnest(ARRAY[
           'ab_experiments',
           'health_check',
           'experiment_runs',
           'knowledge_patterns',
           'optimizations',
           'case_embeddings',
           'user_feedbacks',
           'analysis_cases',
           'kg_entities',
           'kg_relations',
         'kg_corrections',
         'kg_snapshots',
         'user_preferences',
         'report_versions',
         'knowledge_docs'
         ]) LIMIT 1 OFFSET ordinality - 1)
         THEN 'EXISTS'
         ELSE 'MISSING'
       END as status
FROM unnest(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]) WITH ORDINALITY;

-- 2. 从用户系统迁移的表
SELECT 'User System Tables' as category,
       unnest(ARRAY[
         'users',
         'user_sessions',
         'user_interactions',
         'user_profiles',
         'recommendation_history',
         'user_feedback'
       ]) as table_name,
       CASE 
         WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = unnest(ARRAY[
           'users',
           'user_sessions',
           'user_interactions',
           'user_profiles',
           'recommendation_history',
           'user_feedback'
         ]) LIMIT 1 OFFSET ordinality - 1)
         THEN 'EXISTS'
         ELSE 'MISSING'
       END as status
FROM unnest(ARRAY[1,2,3,4,5,6]) WITH ORDINALITY;

-- 3. 从推荐基础设施迁移的表
SELECT 'Recommendation Infrastructure Tables' as category,
       unnest(ARRAY[
         'recommendation_knowledge',
         'recommendation_items',
         'recommendation_embeddings',
         'recommendation_cases',
         'recommendation_scenarios',
         'recommendation_algorithms'
       ]) as table_name,
       CASE 
         WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = unnest(ARRAY[
           'recommendation_knowledge',
           'recommendation_items',
           'recommendation_embeddings',
           'recommendation_cases',
           'recommendation_scenarios',
           'recommendation_algorithms'
         ]) LIMIT 1 OFFSET ordinality - 1)
         THEN 'EXISTS'
         ELSE 'MISSING'
       END as status
FROM unnest(ARRAY[1,2,3,4,5,6]) WITH ORDINALITY;
