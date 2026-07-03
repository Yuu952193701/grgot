import React, { useState, useRef, useEffect } from 'react';
import { useAppState } from '../context/AppContext';
import { WorkflowStep, ColorState } from '../types';
import { DEFAULT_PRE_STEPS, DEFAULT_POST_STEPS, DEFAULT_POST_SERVICE_STEPS, DEFAULT_BID_STEPS } from '../data';
import { formatDateTime } from '../utils/time';
import { Plus, Trash2, GripVertical, RefreshCw, Eye, Edit3, Settings2, Database, Download, Upload, RotateCcw, AlertTriangle, FileCheck, Terminal, ShieldAlert, FolderOpen, Tag, ExternalLink, RefreshCw as SpinIcon, Copy, Star } from 'lucide-react';

export const Settings: React.FC = () => {
  const {
    preWorkflow,
    postWorkflow,
    postServiceWorkflow,
    updatePreWorkflow,
    updatePostWorkflow,
    updatePostServiceWorkflow,
    backups,
    createBackup,
    restoreBackup,
    deleteBackup,
    exportDatabase,
    importDatabase,
    isDatabaseConnecting,
    systemLogs,
    clearSystemLogs,
    projects,
    contracts,
    bids,
    bidWorkflow,
    updateBidWorkflow,
    recommendedTags,
    addRecommendedTag,
    updateRecommendedTag,
    deleteRecommendedTag,
    dbConfig,
    selectFolder,
    migrateDatabase,
    openDbFolder,
    restoreDefaultDbLocation,
    workflowTemplates,
    addWorkflowTemplate,
    deleteWorkflowTemplate,
    updateWorkflowTemplate,
    duplicateWorkflowTemplate,
    setDefaultWorkflowTemplate,
  } = useAppState();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeWorkflowTab, setActiveWorkflowTab] = useState<'pre' | 'post' | 'post-service' | 'bid'>('pre');
  
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const moduleType: 'pre' | 'purchase' | 'service' | 'bid' = 
    activeWorkflowTab === 'pre' ? 'pre' :
    activeWorkflowTab === 'post' ? 'purchase' :
    activeWorkflowTab === 'post-service' ? 'service' : 'bid';

  const moduleTemplates = workflowTemplates.filter(t => t.module === moduleType);

  useEffect(() => {
    const currentTemplateExists = selectedTemplateId && moduleTemplates.some(t => t.id === selectedTemplateId);
    if (!currentTemplateExists) {
      const defaultTemplate = moduleTemplates.find(t => t.isDefault) || moduleTemplates[0];
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else {
        setSelectedTemplateId(null);
      }
    }
  }, [activeWorkflowTab]);

  const selectedTemplate = workflowTemplates.find(t => t.id === selectedTemplateId) || moduleTemplates.find(t => t.isDefault) || moduleTemplates[0];
  
  // States for adding a new step
  const [newStepName, setNewStepName] = useState('');
  const [newStepColor, setNewStepColor] = useState<ColorState>('yellow');

  // States for recommended tags management
  const [newTagName, setNewTagName] = useState('');
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');

  // Drag and drop states for workflow sorting
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleModifyLocation = async () => {
    try {
      const selectedDir = await selectFolder();
      if (!selectedDir) return;
      
      const confirmMove = window.confirm(`系统将自动将当前数据库 data.db 以及 ${backups.length} 份备份文件迁移到新目录：\n\n新目录: ${selectedDir}\n\n迁移期间请勿关闭程序。确定要继续迁移吗？`);
      if (!confirmMove) return;

      const res = await migrateDatabase(selectedDir);
      if (res.success) {
        alert("数据库迁移成功！新保存目录已生效。");
      } else {
        alert(`数据库迁移失败！\n原因: ${res.error || "未知异常"}\n系统将继续使用原数据库。`);
      }
    } catch (err: any) {
      alert(`迁移操作发生异常：${err?.message || err}`);
    }
  };

  const handleRestoreDefault = async () => {
    try {
      const confirmRestore = window.confirm(`确定要将数据库存储位置恢复为默认出厂路径吗？\n\n默认路径: ${dbConfig.defaultDbDir}\n\n系统将自动迁移当前数据到该默认目录。`);
      if (!confirmRestore) return;

      const res = await restoreDefaultDbLocation();
      if (res.success) {
        alert("已成功恢复至默认存储路径！");
      } else {
        alert(`恢复默认存放位置失败：${res.error || "未知错误"}`);
      }
    } catch (err: any) {
      alert(`恢复默认路径操作发生异常：${err?.message || err}`);
    }
  };

  const currentWorkflow = selectedTemplate?.steps || [];

  const handleUpdate = (updated: WorkflowStep[]) => {
    if (selectedTemplate) {
      updateWorkflowTemplate(selectedTemplate.id, { steps: updated });
    }
  };

  // Drag & drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const updated = [...currentWorkflow];
    const draggedItem = updated[draggedIndex];
    // Remove from original position
    updated.splice(draggedIndex, 1);
    // Insert into target position
    updated.splice(targetIndex, 0, draggedItem);

    handleUpdate(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // 1. Add step to current workflow
  const handleAddStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepName.trim()) return;

    const newStep: WorkflowStep = {
      id: `step-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      name: newStepName.trim(),
      color: newStepColor
    };

    handleUpdate([...currentWorkflow, newStep]);
    setNewStepName('');
    setNewStepColor('yellow');
  };

  // 2. Delete step from current workflow
  const handleDeleteStep = (id: string, name: string) => {
    if (currentWorkflow.length <= 1) {
      alert('工作流程中必须保留至少一步。');
      return;
    }
    if (window.confirm(`确认删除步骤【${name}】吗？流转在此阶段的项目在前进/后退时可能重置到首个默认阶段。`)) {
      const filtered = currentWorkflow.filter(step => step.id !== id);
      handleUpdate(filtered);
    }
  };

  // 3. Move step index Up/Down to rearrange order
  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === currentWorkflow.length - 1) return;

    const updated = [...currentWorkflow];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    // Swap items
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    handleUpdate(updated);
  };

  // 4. Update custom name inline
  const handleRenameStep = (index: number, newName: string) => {
    const updated = [...currentWorkflow];
    updated[index] = { ...updated[index], name: newName };
    handleUpdate(updated);
  };

  // 5. Update custom stage color state
  const handleChangeColor = (index: number, newColor: ColorState) => {
    const updated = [...currentWorkflow];
    updated[index] = { ...updated[index], color: newColor };
    handleUpdate(updated);
  };

  // 6. Reset to Factory Default
  const handleResetToDefault = () => {
    if (window.confirm('确认要重置当前选中的流程模板，恢复到系统出厂默认步骤吗？')) {
      const defaultSteps = activeWorkflowTab === 'pre' ? DEFAULT_PRE_STEPS :
                           activeWorkflowTab === 'post' ? DEFAULT_POST_STEPS :
                           activeWorkflowTab === 'post-service' ? DEFAULT_POST_SERVICE_STEPS : DEFAULT_BID_STEPS;
      handleUpdate(defaultSteps);
    }
  };

  // 7. Simulated DB metrics
  const getActiveDbSize = () => {
    const stateObj = { projects, contracts, preWorkflow, postWorkflow, bids, bidWorkflow };
    const len = JSON.stringify(stateObj).length;
    return `${(len / 1024 + 1.2).toFixed(1)} KB`;
  };

  const handleManualBackup = async () => {
    const res = await createBackup('manual');
    if (res.success) {
      alert(`🎉 备份成功！已在备份文件夹归档: ${res.filename}`);
    } else {
      alert(`❌ 备份失败: ${res.error}`);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (window.confirm(`⚠️ 二次确认警告：确认要将系统恢复到备份点【${filename}】吗？\n\n数据还原操作将用该备份的全部【采购需求】和【合同文档】记录【彻底覆盖】您当前活动的数据！当前未持久化备份的历史改动都将彻底遗失，且不可以撤销。\n\n是否继续还原数据？`)) {
      const res = await restoreBackup(filename);
      if (res.success) {
        alert(`🎉 主库历史回溯覆盖完成！SQLite 分区数据重构配平就绪。`);
      } else {
        alert(`❌ 还原遭遇错误拦截: ${res.error}`);
      }
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (window.confirm(`⚠️ 外部数据注入预警：您是否确定载入外部数据库文书 【${file.name}】？\n\n导入非标准或损坏的文件，可能会造成进程读写机制死锁、索引紊乱或当前进程主库严重损毁！系统已在底层为您开启全表校验及防灾回滚锁。\n\n是否继续物理引入并覆写 data.db？`)) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result as string;
        try {
          const res = await importDatabase(text, file.name);
          if (res.success) {
            alert(`🎉 物理导入成功！外部 SQLite (data.db) 扇区分片加载配平，索引成功重建！`);
          } else {
            alert(`❌ 导入解析未通过: ${res.error}`);
          }
        } catch (err) {
          alert(`❌ 解析失败：该格式不符合系统的 SQLite 数据存储模型。未检测到合法验证头。`);
        }
      };
      reader.readAsText(file);
    }
    e.target.value = ''; // Reset file slot
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto relative pb-12">
      
      {/* Settings Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center space-x-2">
          <span>⚙️ 本地商务工作台系统配置</span>
        </h2>
        <p className="text-sm text-slate-400 mt-0.5">
          在此设定前置需求步骤、后置采购合同里程碑，或管理离线 SQLite 数据库的安全冷备，规避任何硬件及误删断电风险。
        </p>
      </div>

      {/* ⚙️ 业务流程模板引擎管理中心 */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden animate-fade-in">
        {/* Header Banner */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Settings2 size={16} className="text-blue-500" />
              <span>⚙️ 业务流程模板配置管理</span>
            </h3>
            <p className="text-xs text-slate-400">
              为前置工作、采购合同、服务合同及标书配置多套定制化的流程模板。支持自由复制、重命名、拖拽排序及默认模板设定。
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleResetToDefault}
              className="text-xs text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-100 rounded-lg px-3 py-1.5 font-semibold flex items-center space-x-1 transition-all cursor-pointer"
              title="恢复当前模板到系统出厂默认步骤"
            >
              <RefreshCw size={12} />
              <span>重置当前模板</span>
            </button>
          </div>
        </div>

        {/* Tab selection for modules */}
        <div className="border-b border-slate-100 px-5 py-3 bg-slate-50/30 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveWorkflowTab('pre')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeWorkflowTab === 'pre'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-3xs'
            }`}
          >
            <span>📁 前置需求模块</span>
          </button>
          
          <button
            onClick={() => setActiveWorkflowTab('post')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeWorkflowTab === 'post'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-3xs'
            }`}
          >
            <span>📄 采购合同模块</span>
          </button>

          <button
            onClick={() => setActiveWorkflowTab('post-service')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeWorkflowTab === 'post-service'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-3xs'
            }`}
          >
            <span>⚙️ 服务合同模块</span>
          </button>

          <button
            onClick={() => setActiveWorkflowTab('bid')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer ${
              activeWorkflowTab === 'bid'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 shadow-3xs'
            }`}
          >
            <span>🎯 标书管理模块</span>
          </button>
        </div>

        {/* Content Section: Sidebar templates list + Steps customizer */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-100 min-h-[420px]">
          
          {/* Left Column: Templates List sidebar */}
          <div className="p-5 bg-slate-50/50 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">已存流程模板列表</span>
                <span className="font-mono text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.2 rounded">
                  共 {moduleTemplates.length} 个模板
                </span>
              </div>

              <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                {moduleTemplates.map(template => {
                  const isSelected = template.id === selectedTemplateId;
                  return (
                    <div
                      key={template.id}
                      onClick={() => setSelectedTemplateId(template.id)}
                      className={`group p-3 rounded-lg border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50/60 border-blue-200/80 shadow-3xs'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-4xs'
                      }`}
                    >
                      <div className="flex items-center space-x-2 min-w-0">
                        <FileCheck size={14} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                        <span className={`text-xs truncate font-bold ${isSelected ? 'text-blue-800' : 'text-slate-700'}`}>
                          {template.name}
                        </span>
                        {template.isDefault && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-1 py-0.2 rounded-sm border border-amber-200 flex-shrink-0 flex items-center gap-0.5">
                            <Star size={8} fill="currentColor" className="text-amber-500" />
                            <span>默认</span>
                          </span>
                        )}
                      </div>

                      {/* Hover action icons */}
                      <div className="flex items-center space-x-1.5 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        {!template.isDefault && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDefaultWorkflowTemplate(template.id);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer transition-colors"
                            title="设为系统默认模板"
                          >
                            <Star size={11} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateWorkflowTemplate(template.id);
                          }}
                          className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                          title="复制并新建为副本"
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newName = prompt("请输入新的模板名称:", template.name);
                            if (newName && newName.trim()) {
                              updateWorkflowTemplate(template.id, { name: newName.trim() });
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer transition-colors"
                          title="重命名模板"
                        >
                          <Edit3 size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (moduleTemplates.length <= 1) {
                              alert("每个业务模块必须保留至少一个流程模板。");
                              return;
                            }
                            if (confirm(`确定要彻底废弃该流程模板【${template.name}】吗？删除后，关联此模板的项目将自动过渡到默认模板。`)) {
                              deleteWorkflowTemplate(template.id);
                              if (selectedTemplateId === template.id) {
                                const remaining = moduleTemplates.filter(t => t.id !== template.id);
                                const fallback = remaining.find(t => t.isDefault) || remaining[0];
                                setSelectedTemplateId(fallback ? fallback.id : null);
                              }
                            }
                          }}
                          className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                          title="删除模板"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom: Add Template Button */}
            <div className="pt-4 mt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const name = prompt("请输入新流程模板名称:", "自定义流程模板");
                  if (name && name.trim()) {
                    const newTpl = addWorkflowTemplate({
                      module: moduleType,
                      name: name.trim(),
                      steps: selectedTemplate ? selectedTemplate.steps : (
                        activeWorkflowTab === 'pre' ? DEFAULT_PRE_STEPS :
                        activeWorkflowTab === 'post' ? DEFAULT_POST_STEPS :
                        activeWorkflowTab === 'post-service' ? DEFAULT_POST_SERVICE_STEPS : DEFAULT_BID_STEPS
                      )
                    });
                    if (newTpl) {
                      setSelectedTemplateId(newTpl.id);
                    }
                  }
                }}
                className="w-full py-2 border border-dashed border-blue-200 text-blue-600 hover:bg-blue-50/60 hover:border-blue-300 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
              >
                <Plus size={13} />
                <span>+ 新建业务流程模板</span>
              </button>
            </div>
          </div>

          {/* Right Column: Template Steps list */}
          <div className="md:col-span-2 p-5 flex flex-col justify-between">
            {selectedTemplate ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 font-semibold px-1 gap-1 border-b border-slate-50 pb-2">
                  <span className="flex items-center gap-1.5 text-blue-600 font-medium">
                    <span>💡 流程: <b>{selectedTemplate.name}</b> · 按住 <b>Grip 拖手</b> 上下拖拽调整路径</span>
                  </span>
                  <span className="font-mono text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.2 rounded font-normal self-start sm:self-auto">
                    共 {currentWorkflow.length} 个自定义工作状态
                  </span>
                </div>

                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {currentWorkflow.map((step, index) => {
                    const matchesColor = step.color;
                    return (
                      <div
                        key={step.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onDrop={(e) => handleDrop(e, index)}
                        className={`bg-white border p-3 rounded-lg shadow-3xs flex items-center justify-between group hover:border-slate-300 hover:shadow-2xs transition-all animate-fade-in ${
                          draggedIndex === index 
                            ? 'opacity-40 border-dashed border-blue-400 bg-blue-50/20' 
                            : dragOverIndex === index
                            ? 'border-blue-400 bg-blue-50/10 scale-[1.01]'
                            : 'border-slate-200/70'
                        }`}
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          {/* Drag Handle */}
                          <div 
                            className="flex items-center space-x-1 font-mono text-xs font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 py-0.5 px-2 rounded cursor-grab active:cursor-grabbing select-none transition-colors"
                            title="按住拖拽以调整次序"
                          >
                            <GripVertical size={12} className="text-slate-400 flex-shrink-0" />
                            <span>#{index + 1}</span>
                          </div>
                          
                          {/* Status Dot */}
                          <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                            matchesColor === 'yellow' ? 'bg-amber-400' :
                            matchesColor === 'green' ? 'bg-emerald-500' :
                            matchesColor === 'blue' ? 'bg-blue-500' :
                            'bg-rose-500'
                          }`} />

                          <input
                            type="text"
                            value={step.name}
                            draggable={false}
                            onDragStart={(e) => e.stopPropagation()}
                            onChange={(e) => handleRenameStep(index, e.target.value)}
                            className="font-bold text-slate-700 text-sm focus:border-blue-500 focus:outline-none border-b border-transparent hover:border-slate-300 pb-0.5 flex-1 max-w-xs transition-colors"
                            placeholder="输入新步骤名称..."
                          />
                        </div>

                        {/* Actions bar for workflow config */}
                        <div className="flex items-center space-x-2.5" draggable={false} onDragStart={(e) => e.stopPropagation()}>
                          {/* Color selection circles buttons */}
                          <div className="hidden md:flex items-center space-x-1 border border-slate-100 rounded-md p-0.5 bg-slate-50/50">
                            <button
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              title="标记为用户普通交互状态 (黄色)"
                              onClick={() => handleChangeColor(index, 'yellow')}
                              className={`h-4.5 w-4.5 rounded-sm bg-amber-400 flex items-center justify-center border hover:scale-105 transition-transform cursor-pointer ${
                                step.color === 'yellow' ? 'border-slate-900 shadow-2xs scale-102' : 'border-transparent opacity-60'
                              }`}
                            />
                            <button
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              title="标记为流转等待执行阶段 (绿色)"
                              onClick={() => handleChangeColor(index, 'green')}
                              className={`h-4.5 w-4.5 rounded-sm bg-emerald-500 flex items-center justify-center border hover:scale-105 transition-transform cursor-pointer ${
                                step.color === 'green' ? 'border-slate-900 shadow-2xs scale-102' : 'border-transparent opacity-60'
                              }`}
                            />
                            <button
                              draggable={false}
                              onDragStart={(e) => e.stopPropagation()}
                              title="标记为归档完成结算阶段 (蓝色)"
                              onClick={() => handleChangeColor(index, 'blue')}
                              className={`h-4.5 w-4.5 rounded-sm bg-blue-500 flex items-center justify-center border hover:scale-105 transition-transform cursor-pointer ${
                                step.color === 'blue' ? 'border-slate-900 shadow-2xs scale-102' : 'border-transparent opacity-60'
                              }`}
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() => handleDeleteStep(step.id, step.name)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="删除此步骤"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Quick Add node inline form */}
                <form onSubmit={handleAddStep} className="bg-slate-50 border border-slate-100 p-3 rounded-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3" draggable={false} onDragStart={(e) => e.stopPropagation()}>
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-500 flex-shrink-0">追加新步骤:</span>
                    <input
                      type="text"
                      value={newStepName}
                      onChange={(e) => setNewStepName(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-700 placeholder-slate-400 focus:outline-none focus:border-blue-500 flex-1 min-w-0"
                      placeholder="如：第三方理货、供应商核算、尾款支付"
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-3 flex-shrink-0">
                    <div className="flex items-center space-x-1 border border-slate-200 bg-white p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setNewStepColor('yellow')}
                        className={`h-4 w-4 rounded-sm bg-amber-400 cursor-pointer border ${
                          newStepColor === 'yellow' ? 'border-slate-850 shadow-3xs scale-105' : 'border-transparent opacity-50'
                        }`}
                        title="标准跟进状态"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStepColor('green')}
                        className={`h-4 w-4 rounded-sm bg-emerald-500 cursor-pointer border ${
                          newStepColor === 'green' ? 'border-slate-850 shadow-3xs scale-105' : 'border-transparent opacity-50'
                        }`}
                        title="重要推进节点"
                      />
                      <button
                        type="button"
                        onClick={() => setNewStepColor('blue')}
                        className={`h-4 w-4 rounded-sm bg-blue-500 cursor-pointer border ${
                          newStepColor === 'blue' ? 'border-slate-850 shadow-3xs scale-105' : 'border-transparent opacity-50'
                        }`}
                        title="终结归档节点"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={!newStepName.trim()}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        newStepName.trim()
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs cursor-pointer'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      插入到末尾
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10">
                <FileCheck size={32} className="text-slate-300 mb-2" />
                <span className="text-xs">暂无选定的流程模板，请先在左侧选择或创建一个。</span>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 🏷️ 推荐标签管理中心 (Focused on custom user tags management) */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        {/* Section Title Banner */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Tag size={16} className="text-amber-500" />
              <span>🏷️ 常用推荐标签配置管理</span>
            </h3>
            <p className="text-xs text-slate-400">
              在此添加、修改或删除各模块创建时快捷点选的“推荐标签”。保持标签库精简，提升打标效率。
            </p>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Tag Quick Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (newTagName.trim()) {
                addRecommendedTag(newTagName.trim());
                setNewTagName('');
              }
            }}
            className="flex items-center gap-3 bg-slate-50/50 p-3 rounded-lg border border-slate-200/60"
          >
            <div className="relative flex-1">
              <Tag size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="输入新增常用推荐标签名称（如：机油、电缆、外协服务）"
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-100 focus:border-blue-500 focus:outline-none placeholder-slate-400 font-medium text-slate-700"
              />
            </div>
            <button
              type="submit"
              disabled={!newTagName.trim()}
              className={`px-4 py-1.8 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                newTagName.trim()
                  ? 'bg-amber-550 bg-amber-500 hover:bg-amber-650 text-white shadow-3xs cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus size={12} />
              <span>新增推荐标签</span>
            </button>
          </form>

          {/* Tags List Grid */}
          {recommendedTags.length === 0 ? (
            <div className="text-center py-8 bg-slate-50/30 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
              💡 暂无任何自定义推荐标签。请在上方输入添加，方便项目快速打标！
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
              {recommendedTags.map((tag) => {
                const isEditing = editingTagId === tag.id;
                return (
                  <div
                    key={tag.id}
                    className={`p-2.5 rounded-lg border transition-all flex items-center justify-between gap-2 group ${
                      isEditing
                        ? 'bg-blue-50/30 border-blue-300 ring-2 ring-blue-50'
                        : 'bg-white border-slate-200/80 hover:border-amber-300 hover:bg-slate-50/45'
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-1.5 w-full">
                        <input
                          type="text"
                          value={editingTagName}
                          onChange={(e) => setEditingTagName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (editingTagName.trim()) {
                                updateRecommendedTag(tag.id, editingTagName.trim());
                                setEditingTagId(null);
                              }
                            } else if (e.key === 'Escape') {
                              setEditingTagId(null);
                            }
                          }}
                          className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-xs font-bold text-slate-700 w-full focus:outline-none focus:border-blue-500 font-sans"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (editingTagName.trim()) {
                              updateRecommendedTag(tag.id, editingTagName.trim());
                              setEditingTagId(null);
                            }
                          }}
                          className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded font-bold hover:bg-emerald-100 cursor-pointer shrink-0"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTagId(null)}
                          className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-bold hover:bg-slate-200 cursor-pointer shrink-0"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center space-x-1.5 truncate">
                          <span className="text-amber-500 text-xs flex-shrink-0">#</span>
                          <span className="text-xs font-semibold text-slate-700 truncate">{tag.name}</span>
                        </div>

                        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTagId(tag.id);
                              setEditingTagName(tag.name);
                            }}
                            className="p-1 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 cursor-pointer transition-colors"
                            title="修改标签名称"
                          >
                            <Edit3 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`确定要移除推荐标签“${tag.name}”吗？\n(这不会影响已标记该标签的现有项目/合同/标书)`)) {
                                deleteRecommendedTag(tag.id);
                              }
                            }}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer transition-colors"
                            title="删除推荐标签"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 💾 SQLite DATABASE BACKUP & RESTORE SECTION */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
        
        {/* Section Title Banner */}
        <div className="border-b border-slate-100 bg-slate-50/70 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
              <Database size={16} className="text-blue-500" />
              <span>💾 局域 SQLite 数据库备份与安全恢复中心</span>
            </h3>
            <p className="text-xs text-slate-400">
              用于离线客户端 (Electron + SQLite) 的防灾备份机制。所有数据储存于 <b>app/database/data.db</b>。
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".db"
              onChange={handleImportFile}
              className="hidden"
            />
            
            <button
              onClick={handleManualBackup}
              className="px-3 py-1.8 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-3xs hover:shadow-2xs flex items-center space-x-1 cursor-pointer transition-all"
              title="立即物理复制一份 data.db 镜像存至 app/backup/ "
            >
              <Plus size={12} />
              <span>立即备份数据库</span>
            </button>

            <button
              onClick={exportDatabase}
              className="px-3 py-1.8 bg-white border border-slate-250 text-slate-700 hover:bg-slate-50 hover:text-slate-900 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
              title="打包并下载一份最新的 .db 仿真数据备份盘"
            >
              <Download size={12} />
              <span>导出备份</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.8 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-250 text-xs font-bold rounded-lg flex items-center space-x-1 cursor-pointer transition-all"
              title="导入外部本地的 .db 备份文件"
            >
              <Upload size={12} />
              <span>导入备份</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 border-b border-slate-100">
          
          {/* Left Column: SQLite Storage Management */}
          <div className="lg:col-span-5 p-5 bg-slate-50/45 border-r border-slate-100 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">🗄️ 数据库物理存储管理</span>
              
              <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3.5 shadow-3xs text-xs">
                {/* 1. Database Location */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">当前数据库位置：</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      大小: {getActiveDbSize()}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-150 p-2 rounded font-mono text-slate-700 break-all select-all">
                    <FileCheck size={14} className="text-blue-500 shrink-0" />
                    <span className="text-[11px] font-semibold">{dbConfig.dbPath}</span>
                  </div>
                </div>

                {/* 2. Backup Directory */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">当前备份目录：</span>
                  <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-150 p-2 rounded font-mono text-slate-700 break-all select-all">
                    <FolderOpen size={14} className="text-amber-500 shrink-0" />
                    <span className="text-[11px] font-semibold">{dbConfig.backupDir}\</span>
                  </div>
                </div>

                {/* 3. Location Action Buttons */}
                <div className="pt-1 grid grid-cols-2 gap-2">
                  <button
                    onClick={handleModifyLocation}
                    disabled={isDatabaseConnecting}
                    className="px-2 py-1.8 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 disabled:opacity-50 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <FolderOpen size={12} />
                    <span>修改数据库位置</span>
                  </button>

                  <button
                    onClick={openDbFolder}
                    className="px-2 py-1.8 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-all"
                  >
                    <ExternalLink size={12} />
                    <span>打开所在文件夹</span>
                  </button>
                </div>

                {/* Restore default location */}
                {dbConfig.dbDir !== dbConfig.defaultDbDir && (
                  <div className="pt-1 border-t border-dashed border-slate-150">
                    <button
                      onClick={handleRestoreDefault}
                      disabled={isDatabaseConnecting}
                      className="w-full px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-800 disabled:opacity-50 text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 cursor-pointer transition-all"
                    >
                      <RotateCcw size={11} />
                      <span>恢复为默认存放位置</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Summary list of tables count */}
            <div className="border border-blue-105 bg-blue-50/20 p-3.5 rounded-lg text-xs space-y-1.5">
              <div className="font-bold text-blue-800 flex items-center space-x-1">
                <span>📊 当前活动 SQLite 全表概要</span>
              </div>
              <ul className="space-y-1 font-mono text-[11px] text-slate-550 list-none pl-0">
                <li className="flex justify-between">
                  <span>- 需求项目集 (PreProcurement):</span>
                  <span className="font-bold text-slate-700">{projects.length} 行记录</span>
                </li>
                <li className="flex justify-between">
                  <span>- 合同文卷集 (PostProcurement):</span>
                  <span className="font-bold text-slate-700">{contracts.length} 行记录</span>
                </li>
              </ul>
            </div>

          </div>

          {/* Right Column: Historical backup files catalog */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">🕒 app/backup/ 目录文件清单 (时间倒序)</span>
                <span className="text-[10px] text-slate-400 font-medium">保留最近30个以防占满磁盘</span>
              </div>

              {/* Scrollable list */}
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {backups.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center space-y-2 text-slate-400">
                    <Database size={24} className="opacity-30 text-slate-400" />
                    <span className="text-xs">未检测到任何本地备份盘</span>
                    <p className="text-[10px] text-slate-400">点击右上角 “立即备份” 或重启系统将自动生成备存文档</p>
                  </div>
                ) : (
                  backups.map(b => (
                    <div
                      key={b.filename}
                      className="bg-white border border-slate-200 p-2.5 rounded-lg flex items-center justify-between text-xs hover:border-slate-350 hover:shadow-3xs transition-all"
                    >
                      <div className="space-y-1 min-w-0 pr-2">
                        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                          <span className="font-mono text-slate-800 font-bold truncate block max-w-[195px] sm:max-w-xs" title={b.filename}>
                            {b.filename}
                          </span>
                          
                          {/* Type indicators */}
                          {b.type === 'auto' ? (
                            <span className="text-[8px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1 rounded uppercase tracking-wider scale-90">
                              自动
                            </span>
                          ) : (
                            <span className="text-[8px] font-extrabold bg-blue-50 text-blue-700 border border-blue-200 px-1 rounded uppercase tracking-wider scale-90">
                              手动
                            </span>
                          )}

                          <span className="text-[10px] font-mono text-slate-400 px-1 font-normal select-none">
                            {b.size}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">
                          物理复制时间: {formatDateTime(b.timestamp)}
                        </p>
                      </div>

                      {/* Item Operation Actions */}
                      <div className="flex items-center space-x-2 flex-shrink-0">
                        <button
                          onClick={() => handleRestoreBackup(b.filename)}
                          className="px-2 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-105 hover:bg-blue-100 rounded border border-blue-200 flex items-center space-x-0.5 cursor-pointer transition-colors"
                          title="拉起 SQLite 内核物理覆盖并挂载还原此版本点"
                        >
                          <RotateCcw size={10} />
                          <span>恢复</span>
                        </button>

                        <button
                          onClick={() => deleteBackup(b.filename)}
                          className="p-1 px-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded border border-transparent hover:border-red-100 cursor-pointer transition-colors"
                          title="将源 db 从磁盘空间物理删除"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Offline SQLite Logging Center */}
        <div className="bg-slate-950 p-4 border-t border-slate-900 font-mono text-stone-200 text-xs">
          <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-widest font-sans font-bold border-b border-slate-900 pb-2 mb-2">
            <div className="flex items-center space-x-1.5">
              <Terminal size={12} className="text-teal-400" />
              <span>💻 本地 SQLite 引擎实时日志输出监视线 (Local Database Diagnostic)</span>
            </div>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={clearSystemLogs}
                className="text-[10px] hover:text-white cursor-pointer hover:underline uppercase transition-all bg-transparent border-0"
              >
                [清空终端]
              </button>
            </div>
          </div>

          <div className="h-28 overflow-y-auto text-[11px] leading-normal space-y-1 flex flex-col-reverse text-blue-300">
            {systemLogs.length === 0 ? (
              <div className="text-slate-600 text-center py-6 select-none">[暂无事务输出。开始进行备份或载入手动任务时，终端将物理显卡输出]</div>
            ) : (
              systemLogs.map((log, index) => {
                let colorClass = 'text-slate-400';
                if (log.includes('成功') || log.includes('校验成功') || log.includes('就绪')) colorClass = 'text-emerald-400';
                if (log.includes('警告') || log.includes('预警') || log.includes('自动删除')) colorClass = 'text-amber-400';
                if (log.includes('错误') || log.includes('故障') || log.includes('异常') || log.includes('死锁')) colorClass = 'text-rose-400 font-semibold';
                if (log.includes('主进程') || log.includes('服务控制')) colorClass = 'text-purple-400';
                if (log.includes('手动') || log.includes('强制')) colorClass = 'text-blue-400';
                
                return (
                  <div key={index} className={`font-mono text-left tracking-wide whitespace-pre-wrap ${colorClass}`}>
                    {log}
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Guide text */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-xs text-slate-400 space-y-2 leading-relaxed">
        <h5 className="font-bold text-slate-700">📌 关于流程与冷备份管理的重要提示：</h5>
        <p>1. 如果您在前、后置列表页发现某项目没有上一步/下一步，是因为该项目目前处于该流程对应的第一步或最后一步。</p>
        <p>2. 已有前置或后置项绑定的步骤如果被直接修改名称，旧名进度项目不会丢失，但可能无法触发正确的“上一步/下一步”状态递进，建议您在修改流程后在项目卡片里手动更新对应的步骤到新版属性名称中。</p>
        <p>3. <b>安全防灾警告：</b>本系统采用双核写对齐算法。每次正常关闭浏览器选项卡或退出应用时，系统都将<b>自动于硬盘后台生成当日安全冷备份 backup_YYYY-MM-DD.db</b>。如遇意外事故可直接载入该备份，恢复生产。</p>
      </div>

      {/* Database connection loading freezing screen overlay */}
      {isDatabaseConnecting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-100 max-w-md w-full p-6 space-y-4 animate-scale-up">
            <div className="flex items-center space-x-3 text-blue-600">
              <SpinIcon className="animate-spin text-blue-500 animate-spin" size={24} />
              <h4 className="font-bold text-slate-800 text-base">Local SQLite 事务安全流合并中</h4>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed font-sans">
              正在安全挂起当前活动的 SQLite 活动进程，关闭活动事务管道... 系统正快速覆写硬盘 <b>app/database/data.db</b> 扇区。此过程仅需数秒，请保留桌面进程，勿强制中断或拉下电源。
            </p>
            
            <div className="bg-slate-950 rounded-lg p-3 h-28 overflow-y-auto font-mono text-[10px] text-teal-400 border border-slate-900 leading-normal">
              {systemLogs.slice(0, 4).map((log, i) => (
                <div key={i} className="mb-1 text-left whitespace-pre-wrap">{log}</div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
