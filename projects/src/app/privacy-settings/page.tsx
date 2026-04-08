/**
 * 隐私设置页面
 * 
 * 功能：
 * 1. 数据使用偏好设置
 * 2. 数据导出
 * 3. 数据删除请求
 * 4. 隐私政策说明
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  FileText,
  Eye,
  Database,
  Settings,
} from 'lucide-react';

// ============================================================================
// 类型定义
// ============================================================================

interface PrivacySettings {
  dataCollection: boolean;
  personalizedRecommendations: boolean;
  analyticsTracking: boolean;
  thirdPartySharing: boolean;
  dataRetentionDays: number;
  exportFormat: 'json' | 'csv';
}

// ============================================================================
// 主组件
// ============================================================================

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings>({
    dataCollection: true,
    personalizedRecommendations: true,
    analyticsTracking: true,
    thirdPartySharing: false,
    dataRetentionDays: 90,
    exportFormat: 'json',
  });

  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      // 模拟保存
      await new Promise(resolve => setTimeout(resolve, 1000));
      setMessage({ type: 'success', text: '设置已保存' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: '保存失败' });
    } finally {
      setSaving(false);
    }
  };

  // 导出数据
  const handleExportData = async () => {
    try {
      setExporting(true);
      
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 'user_001',
          dataType: 'all',
          format: settings.exportFormat,
        }),
      });

      if (settings.exportFormat === 'csv') {
        // CSV 直接下载
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `user_data_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        // JSON 响应
        const data = await response.json();
        if (data.success) {
          const blob = new Blob([JSON.stringify(data.data, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = `user_data_${new Date().toISOString().split('T')[0]}.json`;
          link.click();
          URL.revokeObjectURL(url);
        }
      }

      setMessage({ type: 'success', text: '数据导出成功' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: '导出失败' });
    } finally {
      setExporting(false);
    }
  };

  // 删除数据
  const handleDeleteData = async () => {
    try {
      // 模拟删除请求
      await new Promise(resolve => setTimeout(resolve, 1500));
      setMessage({ type: 'success', text: '数据删除请求已提交，将在 7 个工作日内处理' });
      setDeleteDialogOpen(false);
      setTimeout(() => setMessage(null), 5000);
    } catch (e) {
      setMessage({ type: 'error', text: '删除请求失败' });
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8" />
          隐私设置
        </h1>
        <p className="text-muted-foreground">
          管理您的数据使用偏好和隐私设置
        </p>
      </div>

      {/* 消息提示 */}
      {message && (
        <Alert className="mb-6" variant={message.type === 'error' ? 'destructive' : 'default'}>
          {message.type === 'success' ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* 数据使用偏好 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            数据使用偏好
          </CardTitle>
          <CardDescription>
            控制您的数据如何被收集和使用
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="data-collection">数据收集</Label>
              <p className="text-sm text-muted-foreground">
                允许收集您的交互数据以改善服务
              </p>
            </div>
            <Switch
              id="data-collection"
              checked={settings.dataCollection}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, dataCollection: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="personalized">个性化推荐</Label>
              <p className="text-sm text-muted-foreground">
                使用您的数据提供个性化推荐
              </p>
            </div>
            <Switch
              id="personalized"
              checked={settings.personalizedRecommendations}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, personalizedRecommendations: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="analytics">分析追踪</Label>
              <p className="text-sm text-muted-foreground">
                允许收集使用分析数据
              </p>
            </div>
            <Switch
              id="analytics"
              checked={settings.analyticsTracking}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, analyticsTracking: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="third-party">第三方共享</Label>
              <p className="text-sm text-muted-foreground">
                允许与第三方合作伙伴共享数据
              </p>
            </div>
            <Switch
              id="third-party"
              checked={settings.thirdPartySharing}
              onCheckedChange={(checked) =>
                setSettings({ ...settings, thirdPartySharing: checked })
              }
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>数据保留期限</Label>
              <p className="text-sm text-muted-foreground">
                设置数据的保留时间
              </p>
            </div>
            <Select
              value={settings.dataRetentionDays.toString()}
              onValueChange={(value) =>
                setSettings({ ...settings, dataRetentionDays: parseInt(value) })
              }
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 天</SelectItem>
                <SelectItem value="60">60 天</SelectItem>
                <SelectItem value="90">90 天</SelectItem>
                <SelectItem value="180">180 天</SelectItem>
                <SelectItem value="365">1 年</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end">
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? '保存中...' : '保存设置'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            数据管理
          </CardTitle>
          <CardDescription>
            导出或删除您的个人数据
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 数据导出 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                <Label>导出我的数据</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                下载您的所有个人数据副本
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={settings.exportFormat}
                onValueChange={(value: 'json' | 'csv') =>
                  setSettings({ ...settings, exportFormat: value })
                }
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={handleExportData} disabled={exporting}>
                {exporting ? '导出中...' : '导出'}
              </Button>
            </div>
          </div>

          <Separator />

          {/* 数据删除 */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-red-500" />
                <Label>删除我的数据</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                请求删除您的所有个人数据
              </p>
            </div>
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">请求数据删除</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>确认删除数据</DialogTitle>
                  <DialogDescription>
                    此操作将请求删除您的所有个人数据，包括：
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2 py-4">
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    <li>交互历史记录</li>
                    <li>用户画像数据</li>
                    <li>反馈和评论</li>
                    <li>推荐偏好设置</li>
                  </ul>
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>警告</AlertTitle>
                    <AlertDescription>
                      数据删除后无法恢复，您将失去所有个性化推荐功能
                    </AlertDescription>
                  </Alert>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                    取消
                  </Button>
                  <Button variant="destructive" onClick={handleDeleteData}>
                    确认删除
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>

      {/* 隐私政策 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            隐私政策
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <p className="font-medium">数据透明</p>
                <p className="text-sm text-muted-foreground">
                  您可以随时查看我们收集的数据
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium">数据安全</p>
                <p className="text-sm text-muted-foreground">
                  所有数据均加密存储，严格保护隐私
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Download className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <p className="font-medium">数据可移植</p>
                <p className="text-sm text-muted-foreground">
                  支持导出数据，方便迁移
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium">删除权</p>
                <p className="text-sm text-muted-foreground">
                  您有权要求删除所有个人数据
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="text-sm text-muted-foreground">
            <p>
              我们遵守《个人信息保护法》等相关法律法规，保护您的个人隐私。
              如有疑问，请联系我们的隐私团队：privacy@example.com
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
