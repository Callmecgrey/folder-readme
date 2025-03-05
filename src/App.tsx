'use client';

import React, { useState, useRef } from 'react';
import { 
  FolderOpen, 
  X, 
  Eye, 
  RefreshCw, 
  FileText, 
  ChevronDown, 
  ChevronUp, 
  FolderX,
  Plus,
  Trash2
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

function App() {
  const [projectFiles, setProjectFiles] = useState<FileList | null>(null);
  const [ignoreFoldersList, setIgnoreFoldersList] = useState<{ id: string; files: FileList | null }[]>([]);
  const [previewContent, setPreviewContent] = useState<string>("[Preview will appear here]");
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [alertDialog, setAlertDialog] = useState({ open: false, message: "" });
  const [projectExpanded, setProjectExpanded] = useState(false);
  const [rootFolderName, setRootFolderName] = useState("");
  const [structure, setStructure] = useState("");

  const projectInputRef = useRef<HTMLInputElement>(null);

  // Helper: Build a tree object from an array of file paths
  const buildTree = (filePaths: string[]): Record<string, Record<string, unknown>> => {
    const tree: Record<string, Record<string, unknown>> = {};
    filePaths.forEach(path => {
      const parts = path.split('/');
      let node: Record<string, Record<string, unknown>> = tree;
      parts.forEach(part => {
        if (!node[part]) {
          node[part] = {};
        }
        node = node[part] as Record<string, Record<string, unknown>>;
      });
    });
    return tree;
  };

  // Helper: Recursively remove any key equal to keyToRemove from the tree
  const removeKeyRecursively = (obj: Record<string, Record<string, unknown>>, keyToRemove: string) => {
    for (const key in obj) {
      if (key === keyToRemove) {
        delete obj[key];
      } else {
        removeKeyRecursively(obj[key] as Record<string, Record<string, unknown>>, keyToRemove);
      }
    }
  };

  // Helper: Convert the tree object to a formatted string
  const treeToString = (tree: Record<string, Record<string, unknown>>, indent = ''): string[] => {
    let lines: string[] = [];
    const keys = Object.keys(tree);
    keys.forEach((key, index) => {
      const isLast = index === keys.length - 1;
      const prefix = isLast ? indent + '└── ' : indent + '├── ';
      lines.push(prefix + key);
      const children = tree[key];
      if (Object.keys(children).length > 0) {
        const childIndent = indent + (isLast ? '    ' : '│   ');
        lines = lines.concat(treeToString(children as Record<string, Record<string, unknown>>, childIndent));
      }
    });
    return lines;
  };

  // Show alert dialog
  const showAlert = (message: string) => {
    setAlertDialog({ open: true, message });
  };

  // Handle project files selection
  const handleProjectFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProjectFiles(e.target.files);
    } else {
      setProjectFiles(null);
    }
  };

  // Handle adding a new ignore folder input
  const handleAddIgnoreFolder = () => {
    setIgnoreFoldersList([...ignoreFoldersList, { id: Date.now().toString(), files: null }]);
  };

  // Handle ignore files selection for a specific input
  const handleIgnoreFilesChange = (id: string, files: FileList | null) => {
    setIgnoreFoldersList(prevList => 
      prevList.map(item => 
        item.id === id ? { ...item, files } : item
      )
    );
  };

  // Handle removing an ignore folder input
  const handleRemoveIgnoreFolder = (id: string) => {
    setIgnoreFoldersList(prevList => prevList.filter(item => item.id !== id));
  };

  // Handle start over
  const handleStartOver = () => {
    if (projectInputRef.current) projectInputRef.current.value = "";
    setProjectFiles(null);
    setIgnoreFoldersList([]);
    setPreviewContent("[Preview will appear here]");
    setShowGenerateButton(false);
    setShowProgress(false);
    setProgress(0);
    setRootFolderName("");
    setStructure("");
  };

  // Handle preview generation
  const handlePreview = () => {
    if (!projectFiles || projectFiles.length === 0) {
      showAlert("Please select a project folder.");
      return;
    }

    // Determine the root folder name from the project input
    const firstFilePath = projectFiles[0].webkitRelativePath;
    const rootFolder = firstFilePath.split('/')[0];
    setRootFolderName(rootFolder);

    // Build a set of ignore folder names from all ignore inputs
    const ignoreFolders = new Set<string>();
    ignoreFoldersList.forEach(({ files }) => {
      if (files) {
        for (let i = 0; i < files.length; i++) {
          const parts = files[i].webkitRelativePath.split('/');
          if (parts.length > 0) {
            ignoreFolders.add(parts[0]);
          }
        }
      }
    });
    
    // Automatically add unwanted folders
    ignoreFolders.add("node_modules");
    ignoreFolders.add(".git");
    ignoreFolders.add(".DS_Store");

    // Build a list of project file paths
    const filePaths: string[] = [];
    const totalFiles = projectFiles.length;
    
    // Show progress bar
    setShowProgress(true);
    setProgress(0);

    // Process files with a small delay to allow UI to update
    setTimeout(() => {
      for (let i = 0; i < totalFiles; i++) {
        const file = projectFiles[i];
        const relPath = file.webkitRelativePath;
        const firstPart = relPath.split('/')[0];
        if (!ignoreFolders.has(firstPart)) {
          filePaths.push(relPath);
        }
        
        // Update progress every 100 files to avoid excessive re-renders
        if (i % 100 === 0 || i === totalFiles - 1) {
          setProgress(Math.round(((i + 1) / totalFiles) * 100));
        }
      }

      // Build tree from the remaining file paths
      const tree = buildTree(filePaths);
      removeKeyRecursively(tree, "node_modules");
      removeKeyRecursively(tree, ".git");
      removeKeyRecursively(tree, ".DS_Store");

      let structureLines: string[] = [];
      structureLines.push(rootFolder);
      structureLines = structureLines.concat(treeToString(tree, ''));
      const structureText = structureLines.join('\n');
      setStructure(structureText);

      // Display preview in the right panel
      const lines = structureText.split('\n');
      let preview = lines.slice(0, 100).join('\n');
      if (lines.length > 100) {
        preview += `\n... (truncated, total ${lines.length} lines)`;
      }
      setPreviewContent(preview);
      setShowGenerateButton(true);
    }, 50);
  };

  // Handle downloading the generated README file
  const handleGenerateReadme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structure || !rootFolderName) {
      showAlert("Missing structure or folder name.");
      return;
    }
    const readmeContent = `# Project File and Folder Structure\n\nBelow is the structure of the project:\n\n\`\`\`\n${structure}\n\`\`\``;
    const blob = new Blob([readmeContent], { type: "text/markdown;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${rootFolderName}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  // Get file count from FileList
  const getFileCount = (files: FileList | null): number => {
    return files ? files.length : 0;
  };

  // Get root folder name from FileList
  const getRootFolderName = (files: FileList | null): string => {
    if (!files || files.length === 0) return "";
    const firstFilePath = files[0].webkitRelativePath;
    return firstFilePath.split('/')[0];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-4 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="h-8 w-8 mr-3" />
              <h1 className="text-2xl font-bold">README Generator</h1>
            </div>
            <button 
              onClick={handleStartOver}
              className="flex items-center px-4 py-2 bg-blue-500 bg-opacity-20 hover:bg-opacity-30 rounded-md transition"
            >
              <RefreshCw size={16} className="mr-2" />
              Reset
            </button>
          </div>
        </div>
      </header>

      {/* Alert Dialog */}
      <AlertDialog 
        open={alertDialog.open} 
        onOpenChange={(open: boolean) => setAlertDialog({ ...alertDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
        <AlertDialogTitle>Alert</AlertDialogTitle>
        <AlertDialogDescription>{alertDialog.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
        <AlertDialogAction>OK</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Panel */}
          <div className="w-full lg:w-2/5 space-y-6">
            {/* Project Folder Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FolderOpen className="mr-2 h-5 w-5 text-blue-600" />
                Project Folder
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                <input 
                  type="file" 
                  id="projectFiles" 
                  ref={projectInputRef}
                  onChange={handleProjectFilesChange}
                  webkitdirectory="true"
                  directory=""
                  multiple
                  className="hidden"
                />
                  <label 
                    htmlFor="projectFiles"
                    className="flex-1 flex items-center justify-center px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition cursor-pointer"
                  >
                    <FolderOpen size={18} className="mr-2" />
                    Select Project Folder
                  </label>
                  {projectFiles && (
                    <button 
                      onClick={() => {
                        if (projectInputRef.current) projectInputRef.current.value = "";
                        setProjectFiles(null);
                      }}
                      className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                      title="Clear selection"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                
                {projectFiles && (
                  <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-900">{getRootFolderName(projectFiles)}</div>
                        <div className="text-sm text-gray-600">{getFileCount(projectFiles)} files</div>
                      </div>
                      <button 
                        onClick={() => setProjectExpanded(!projectExpanded)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition"
                      >
                        {projectExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                    
                    {projectExpanded && (
                      <div className="mt-3 max-h-40 overflow-y-auto text-sm bg-white rounded-md border border-gray-200 p-3">
                        <pre className="text-xs text-gray-600">
                          {Array.from(projectFiles).slice(0, 100).map((file, index) => (
                            <div key={index} className="truncate">{file.webkitRelativePath}</div>
                          ))}
                          {projectFiles.length > 100 && (
                            <div className="text-gray-500 mt-2 pt-2 border-t">
                              ... and {projectFiles.length - 100} more files
                            </div>
                          )}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Ignore Folders Selection */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-800 flex items-center">
                  <FolderX className="mr-2 h-5 w-5 text-gray-600" />
                  Folders to Ignore
                </h2>
                <button
                  onClick={handleAddIgnoreFolder}
                  className="flex items-center px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition"
                >
                  <Plus size={16} className="mr-1" />
                  Add Folder
                </button>
              </div>

              <div className="space-y-4">
                {ignoreFoldersList.map(({ id, files }) => (
                  <div key={id} className="relative">
                    <div className="flex items-center gap-2">
                      <input 
                        type="file" 
                        id={`ignore-${id}`}
                        onChange={(e) => handleIgnoreFilesChange(id, e.target.files)}
                        webkitdirectory="true"
                        directory=""
                        multiple
                        className="hidden"
                      />
                      <label 
                        htmlFor={`ignore-${id}`}
                        className="flex-1 flex items-center justify-center px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition cursor-pointer"
                      >
                        <FolderX size={18} className="mr-2" />
                        {files ? getRootFolderName(files) : 'Select Folder'}
                      </label>
                      <button 
                        onClick={() => handleRemoveIgnoreFolder(id)}
                        className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove folder"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                    {files && (
                      <div className="mt-2 text-sm text-gray-600">
                        {getFileCount(files)} files selected
                      </div>
                    )}
                  </div>
                ))}

                {ignoreFoldersList.length === 0 && (
                  <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <FolderX className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No ignore folders selected</p>
                    <button
                      onClick={handleAddIgnoreFolder}
                      className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      Add a folder to ignore
                    </button>
                  </div>
                )}

                <div className="text-xs text-gray-500 mt-3">
                  Note: node_modules, .git, and .DS_Store are automatically ignored
                </div>
              </div>
            </div>

            {/* Preview Button */}
            <button 
              onClick={handlePreview}
              className="w-full flex items-center justify-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!projectFiles}
            >
              <Eye size={18} className="mr-2" />
              Generate Preview
            </button>

            {/* Progress Bar */}
            {showProgress && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Processing Files</span>
                  <span>{progress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            )}
          </div>
          
          {/* Right Panel */}
          <div className="w-full lg:w-3/5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 h-full">
              <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FileText className="mr-2 h-5 w-5 text-gray-600" />
                Preview
              </h2>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-[500px] overflow-y-auto font-mono text-sm">
                <pre className="whitespace-pre-wrap text-gray-700">{previewContent}</pre>
              </div>
              
              {showGenerateButton && (
                <div className="mt-6 flex justify-center">
                  <button 
                    onClick={handleGenerateReadme}
                    className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition inline-flex items-center shadow-sm"
                  >
                    <FileText size={18} className="mr-2" />
                    Generate README.md
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;