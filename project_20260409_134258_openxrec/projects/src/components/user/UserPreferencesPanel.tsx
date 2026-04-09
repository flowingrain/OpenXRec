/**
 * 用户偏好收集组件
 * 
 * 功能：
 * - 收集用户兴趣标签
 * - 调整推荐策略偏好
 * - 设置反馈行为
 * - 提供个性化选项
 */

'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Heart,
  Settings,
  Sparkles,
  Target,
  Layers,
  BookOpen,
  Plus,
  X,
  Save,
  RotateCcw,
  Info
} from 'lucide-react';

/**
 * 用户偏好数据
 */
export interface UserPreferences {
  interests: string[];
  dislikedCategories: string[];
  strategyPreferences: {
    diversity: number;
    novelty: number;
    personalization: number;
  };
  settings: {
    autoSave: boolean;
    showExplanations: boolean;
    enableFeedback: boolean;
  };
}

/**
 * 用户偏好面板属性
 */
export interface UserPreferencesPanelProps {
  preferences?: UserPreferences;
  onSave?: (preferences: UserPreferences) => void;
  onReset?: () => void;
  className?: string;
}

/**
 * 默认偏好
 */
const defaultPreferences: UserPreferences = {
  interests: ['科技', '阅读', '产品'],
  dislikedCategories: [],
  strategyPreferences: {
    diversity: 0.7,
    novelty: 0.6,
    personalization: 0.8
  },
  settings: {
    autoSave: true,
    showExplanations: true,
    enableFeedback: true
  }
};

/**
 * 用户偏好面板组件
 */
export function UserPreferencesPanel({
  preferences,
  onSave,
  onReset,
  className
}: UserPreferencesPanelProps) {
  const [localPreferences, setLocalPreferences] = useState<UserPreferences>(
    preferences || defaultPreferences
  );
  const [newInterest, setNewInterest] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (preferences) {
      setLocalPreferences(preferences);
    }
  }, [preferences]);

  useEffect(() => {
    setHasChanges(JSON.stringify(localPreferences) !== JSON.stringify(preferences || defaultPreferences));
  }, [localPreferences, preferences]);

  // 添加兴趣
  const handleAddInterest = () => {
    if (newInterest.trim() && !localPreferences.interests.includes(newInterest.trim())) {
      setLocalPreferences({
        ...localPreferences,
        interests: [...localPreferences.interests, newInterest.trim()]
      });
      setNewInterest('');
    }
  };

  // 移除兴趣
  const handleRemoveInterest = (interest: string) => {
    setLocalPreferences({
      ...localPreferences,
      interests: localPreferences.interests.filter(i => i !== interest)
    });
  };

  // 添加不喜欢的类别
  const handleAddDislike = (category: string) => {
    if (!localPreferences.dislikedCategories.includes(category)) {
      setLocalPreferences({
        ...localPreferences,
        dislikedCategories: [...localPreferences.dislikedCategories, category]
      });
    }
  };

  // 移除不喜欢的类别
  const handleRemoveDislike = (category: string) => {
    setLocalPreferences({
      ...localPreferences,
      dislikedCategories: localPreferences.dislikedCategories.filter(c => c !== category)
    });
  };

  // 更新策略偏好
  const handleStrategyChange = (key: keyof UserPreferences['strategyPreferences'], value: number[]) => {
    setLocalPreferences({
      ...localPreferences,
      strategyPreferences: {
        ...localPreferences.strategyPreferences,
        [key]: value[0] / 100
      }
    });
  };

  // 更新设置
  const handleSettingChange = (key: keyof UserPreferences['settings'], value: boolean) => {
    setLocalPreferences({
      ...localPreferences,
      settings: {
        ...localPreferences.settings,
        [key]: value
      }
    });
  };

  // 保存偏好
  const handleSave = () => {
    if (onSave) {
      onSave(localPreferences);
    }
  };

  // 重置偏好
  const handleReset = () => {
    setLocalPreferences(defaultPreferences);
    if (onReset) {
      onReset();
    }
  };

  // 常见兴趣标签
  const commonInterests = [
    '科技', '阅读', '音乐', '电影', '旅行', '美食',
    '运动', '游戏', '教育', '艺术', '投资', '健康'
  ];

  // 常见类别
  const commonCategories = [
    '科技产品', '图书', '音乐', '电影', '服装', '食品',
    '运动器材', '游戏', '教育课程', '艺术品', '金融产品', '保健品'
  ];

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              用户偏好
            </CardTitle>
            <CardDescription>
              自定义您的推荐偏好和策略
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={!hasChanges}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              重置
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              <Save className="h-4 w-4 mr-1" />
              保存
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="interests" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="interests" className="text-xs">
              <Heart className="h-3 w-3 mr-1" />
              兴趣
            </TabsTrigger>
            <TabsTrigger value="strategy" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              策略
            </TabsTrigger>
            <TabsTrigger value="settings" className="text-xs">
              <Settings className="h-3 w-3 mr-1" />
              设置
            </TabsTrigger>
            <TabsTrigger value="advanced" className="text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              高级
            </TabsTrigger>
          </TabsList>

          {/* 兴趣标签页 */}
          <TabsContent value="interests" className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium mb-2 block">我的兴趣</label>
              <div className="flex gap-2 mb-3">
                <Input
                  value={newInterest}
                  onChange={(e) => setNewInterest(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddInterest()}
                  placeholder="添加兴趣标签..."
                  className="flex-1"
                />
                <Button size="icon" onClick={handleAddInterest}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {localPreferences.interests.map((interest) => (
                  <Badge key={interest} variant="secondary" className="gap-1">
                    {interest}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveInterest(interest)}
                    />
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium mb-2 block">常见兴趣</label>
              <div className="flex flex-wrap gap-2">
                {commonInterests
                  .filter(i => !localPreferences.interests.includes(i))
                  .slice(0, 6)
                  .map((interest) => (
                    <Badge
                      key={interest}
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary"
                      onClick={() => {
                        setLocalPreferences({
                          ...localPreferences,
                          interests: [...localPreferences.interests, interest]
                        });
                      }}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {interest}
                    </Badge>
                  ))}
              </div>
            </div>

            <Separator />

            <div>
              <label className="text-sm font-medium mb-2 block">不喜欢的类别</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {localPreferences.dislikedCategories.map((category) => (
                  <Badge key={category} variant="destructive" className="gap-1">
                    {category}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => handleRemoveDislike(category)}
                    />
                  </Badge>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                {commonCategories
                  .filter(c => !localPreferences.dislikedCategories.includes(c))
                  .slice(0, 4)
                  .map((category) => (
                    <Badge
                      key={category}
                      variant="outline"
                      className="cursor-pointer hover:bg-destructive/10"
                      onClick={() => handleAddDislike(category)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {category}
                    </Badge>
                  ))}
              </div>
            </div>
          </TabsContent>

          {/* 策略标签页 */}
          <TabsContent value="strategy" className="space-y-6 mt-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">推荐多样性</label>
                <Badge variant="outline">
                  {(localPreferences.strategyPreferences.diversity * 100).toFixed(0)}%
                </Badge>
              </div>
              <Slider
                value={[localPreferences.strategyPreferences.diversity * 100]}
                onValueChange={(value) => handleStrategyChange('diversity', value)}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                提高多样性会推荐更多不同类型的内容
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">推荐新颖性</label>
                <Badge variant="outline">
                  {(localPreferences.strategyPreferences.novelty * 100).toFixed(0)}%
                </Badge>
              </div>
              <Slider
                value={[localPreferences.strategyPreferences.novelty * 100]}
                onValueChange={(value) => handleStrategyChange('novelty', value)}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                提高新颖性会推荐更多新颖和探索性内容
              </p>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">个性化程度</label>
                <Badge variant="outline">
                  {(localPreferences.strategyPreferences.personalization * 100).toFixed(0)}%
                </Badge>
              </div>
              <Slider
                value={[localPreferences.strategyPreferences.personalization * 100]}
                onValueChange={(value) => handleStrategyChange('personalization', value)}
                max={100}
                step={5}
              />
              <p className="text-xs text-muted-foreground mt-1">
                提高个性化会更紧密地基于您的历史行为
              </p>
            </div>
          </TabsContent>

          {/* 设置标签页 */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">自动保存偏好</label>
                <p className="text-xs text-muted-foreground">
                  修改偏好时自动保存到云端
                </p>
              </div>
              <Switch
                checked={localPreferences.settings.autoSave}
                onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">显示推荐解释</label>
                <p className="text-xs text-muted-foreground">
                  在推荐结果中显示详细解释
                </p>
              </div>
              <Switch
                checked={localPreferences.settings.showExplanations}
                onCheckedChange={(checked) => handleSettingChange('showExplanations', checked)}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium">启用反馈收集</label>
                <p className="text-xs text-muted-foreground">
                  允许系统收集您的反馈以优化推荐
                </p>
              </div>
              <Switch
                checked={localPreferences.settings.enableFeedback}
                onCheckedChange={(checked) => handleSettingChange('enableFeedback', checked)}
              />
            </div>
          </TabsContent>

          {/* 高级标签页 */}
          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="text-sm font-medium">高级功能</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    这些功能正在开发中，敬请期待！
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg opacity-50">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Layers className="h-4 w-4" />
                    多目标优化
                  </label>
                  <p className="text-xs text-muted-foreground">
                    同时优化多个推荐目标
                  </p>
                </div>
                <Switch disabled />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg opacity-50">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    知识图谱增强
                  </label>
                  <p className="text-xs text-muted-foreground">
                    使用知识图谱提升推荐质量
                  </p>
                </div>
                <Switch disabled />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg opacity-50">
                <div>
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    主动推荐
                  </label>
                  <p className="text-xs text-muted-foreground">
                    系统主动推送可能感兴趣的内容
                  </p>
                </div>
                <Switch disabled />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
