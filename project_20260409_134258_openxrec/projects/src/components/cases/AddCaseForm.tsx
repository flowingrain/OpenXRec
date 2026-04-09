'use client';

import React, { useState } from 'react';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Plus, 
  X, 
  Loader2,
  Lightbulb,
  Tag
} from 'lucide-react';

interface AddCaseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// 领域选项
const DOMAIN_OPTIONS = [
  { value: 'macro_economy', label: '宏观经济' },
  { value: 'finance', label: '金融市场' },
  { value: 'geopolitics', label: '地缘政治' },
  { value: 'energy', label: '能源' },
  { value: 'trade', label: '国际贸易' },
  { value: 'policy', label: '政策法规' },
  { value: 'technology', label: '科技产业' },
  { value: 'listed_company', label: '上市公司' },
  { value: 'general', label: '综合' },
];

export function AddCaseForm({ isOpen, onClose, onSuccess }: AddCaseFormProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    query: '',
    domain: 'general',
    conclusion: '',
    keyFactorsText: '',
    tagsText: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 验证表单
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.query.trim()) {
      newErrors.query = '请输入分析主题';
    }
    if (!formData.conclusion.trim()) {
      newErrors.conclusion = '请输入分析结论';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 提交表单
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      const keyFactors = formData.keyFactorsText
        .split('\n')
        .map(f => f.trim())
        .filter(Boolean);
      
      const tags = formData.tagsText
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
      
      const response = await fetch('/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_manual_case',
          data: {
            query: formData.query,
            domain: formData.domain,
            conclusion: formData.conclusion,
            keyFactors,
            tags,
          }
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // 重置表单
        setFormData({
          query: '',
          domain: 'general',
          conclusion: '',
          keyFactorsText: '',
          tagsText: '',
        });
        setErrors({});
        onSuccess();
        onClose();
      } else {
        setErrors({ submit: result.error || '添加失败' });
      }
    } catch (error) {
      setErrors({ submit: '网络错误，请重试' });
    } finally {
      setLoading(false);
    }
  };

  // 关闭时重置
  const handleClose = () => {
    setFormData({
      query: '',
      domain: 'general',
      conclusion: '',
      keyFactorsText: '',
      tagsText: '',
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-green-500" />
            添加专家案例
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* 分析主题 */}
          <div className="space-y-2">
            <Label htmlFor="query" className="flex items-center gap-1">
              分析主题 <span className="text-red-500">*</span>
            </Label>
            <Input
              id="query"
              placeholder="例如：美联储加息对新兴市场的影响分析"
              value={formData.query}
              onChange={(e) => setFormData({ ...formData, query: e.target.value })}
              className={errors.query ? 'border-red-500' : ''}
            />
            {errors.query && (
              <p className="text-xs text-red-500">{errors.query}</p>
            )}
          </div>
          
          {/* 领域选择 */}
          <div className="space-y-2">
            <Label htmlFor="domain">分析领域</Label>
            <Select
              value={formData.domain}
              onValueChange={(value) => setFormData({ ...formData, domain: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择领域" />
              </SelectTrigger>
              <SelectContent>
                {DOMAIN_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* 分析结论 */}
          <div className="space-y-2">
            <Label htmlFor="conclusion" className="flex items-center gap-1">
              分析结论 <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="conclusion"
              placeholder="请输入详细的分析结论，包括主要发现、逻辑推理和预测..."
              value={formData.conclusion}
              onChange={(e) => setFormData({ ...formData, conclusion: e.target.value })}
              rows={6}
              className={errors.conclusion ? 'border-red-500' : ''}
            />
            {errors.conclusion && (
              <p className="text-xs text-red-500">{errors.conclusion}</p>
            )}
          </div>
          
          {/* 关键因素 */}
          <div className="space-y-2">
            <Label htmlFor="keyFactors" className="flex items-center gap-1">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              关键因素（可选）
            </Label>
            <Textarea
              id="keyFactors"
              placeholder="每行一个关键因素，例如：&#10;美联储利率政策&#10;美元指数走势&#10;新兴市场资本流动"
              value={formData.keyFactorsText}
              onChange={(e) => setFormData({ ...formData, keyFactorsText: e.target.value })}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              每行一个关键因素，系统将自动提取并关联
            </p>
          </div>
          
          {/* 标签 */}
          <div className="space-y-2">
            <Label htmlFor="tags" className="flex items-center gap-1">
              <Tag className="h-4 w-4 text-blue-500" />
              标签（可选）
            </Label>
            <Input
              id="tags"
              placeholder="用逗号分隔，例如：美联储, 利率, 新兴市场"
              value={formData.tagsText}
              onChange={(e) => setFormData({ ...formData, tagsText: e.target.value })}
            />
            
            {/* 标签预览 */}
            {formData.tagsText && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.tagsText.split(',').map((tag, i) => (
                  tag.trim() && (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {tag.trim()}
                    </Badge>
                  )
                ))}
              </div>
            )}
          </div>
          
          {/* 提交错误 */}
          {errors.submit && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm">
              {errors.submit}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                添加中...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                添加案例
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
