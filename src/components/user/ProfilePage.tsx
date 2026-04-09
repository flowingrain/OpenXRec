'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, RefreshCw, TrendingUp, Clock, Activity } from 'lucide-react';
import type { UserProfile } from '@/types/user';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 获取用户画像
  const fetchProfile = async () => {
    if (!user) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setProfile(result.data);
      } else {
        // 如果画像不存在，自动生成
        await generateProfile();
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  // 生成用户画像
  const generateProfile = async () => {
    if (!user) return;

    setRefreshing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        setProfile(result.data);
      }
    } catch (error) {
      console.error('Failed to generate profile:', error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">暂无用户画像数据</p>
              <Button onClick={generateProfile} disabled={refreshing}>
                {refreshing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  '生成画像'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">用户画像</h1>
          <p className="text-muted-foreground">基于您的交互行为生成的个性化画像</p>
        </div>
        <Button onClick={generateProfile} disabled={refreshing} variant="outline">
          {refreshing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              更新中...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              更新画像
            </>
          )}
        </Button>
      </div>

      {/* 统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总交互次数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_interactions}</div>
            <p className="text-xs text-muted-foreground">累计交互行为</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">浏览次数</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_views}</div>
            <p className="text-xs text-muted-foreground">内容浏览量</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">点赞次数</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{profile.total_likes}</div>
            <p className="text-xs text-muted-foreground">喜欢的推荐</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">画像版本</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">v{profile.profile_version}</div>
            <p className="text-xs text-muted-foreground">最后更新: {new Date(profile.last_updated_at).toLocaleDateString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 兴趣偏好 */}
      <Card>
        <CardHeader>
          <CardTitle>兴趣偏好</CardTitle>
          <CardDescription>基于您的交互行为分析得出的兴趣领域</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(profile.interests)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 10)
              .map(([interest, score]) => (
                <div key={interest} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{interest}</span>
                    <span className="text-sm text-muted-foreground">{Math.round(score * 10) / 10} 次</span>
                  </div>
                  <Progress value={(score / profile.total_interactions) * 100} />
                </div>
              ))}

            {Object.keys(profile.interests).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                暂无兴趣数据，请多与系统互动以生成画像
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 偏好主题 */}
      <Card>
        <CardHeader>
          <CardTitle>偏好主题</CardTitle>
          <CardDescription>您感兴趣的主题和内容</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {profile.preferred_topics.length > 0 ? (
              profile.preferred_topics.map((topic) => (
                <Badge key={topic} variant="secondary">
                  {topic}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                暂无偏好主题数据
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 推荐偏好权重 */}
      <Card>
        <CardHeader>
          <CardTitle>推荐偏好权重</CardTitle>
          <CardDescription>调整推荐算法的偏好权重</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>多样性权重</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(profile.diversity_weight * 100)}%
                </span>
              </div>
              <Progress value={profile.diversity_weight * 100} />
              <p className="text-xs text-muted-foreground">
                控制推荐结果的多样性程度
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>新颖性权重</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(profile.novelty_weight * 100)}%
                </span>
              </div>
              <Progress value={profile.novelty_weight * 100} />
              <p className="text-xs text-muted-foreground">
                控制推荐新内容的倾向
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>相关性权重</Label>
                <span className="text-sm text-muted-foreground">
                  {Math.round(profile.relevance_weight * 100)}%
                </span>
              </div>
              <Progress value={profile.relevance_weight * 100} />
              <p className="text-xs text-muted-foreground">
                控制推荐内容与历史的相关性
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
