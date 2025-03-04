import React, { useState, useRef } from 'react';
import { FolderOpen, X, Eye, RefreshCw, FileText, AlertTriangle, ChevronDown, ChevronUp, FolderX } from 'lucide-react';

declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
    directory?: string;
  }
}

function App() {
  const [projectFiles, setProjectFiles] = useState<FileList | null>(null);
  const [ignoreFiles, setIgnoreFiles] = useState<FileList | null>(null);
  const [previewContent, setPreviewContent] = useState<string>("[Preview will appear here]");
  const [showGenerateButton, setShowGenerateButton] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [alert, setAlert] = useState({ show: false, message: "" });
  const [projectExpanded, setProjectExpanded] = useState(false);
  const [ignoreExpanded, setIgnoreExpanded] = useState(false);
  const [rootFolderName, setRootFolderName] = useState("");
  const [structure, setStructure] = useState("");

  const projectInputRef = useRef<HTMLInputElement>(null);
  const ignoreInputRef = useRef<HTMLInputElement>(null);

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

  // Custom alert function.
  const showCustomAlert = (message: string) => {
    setAlert({ show: true, message });
    setTimeout(() => {
      setAlert({ show: false, message: "" });
    }, 3000);
  };

  // Handle project files selection
  const handleProjectFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setProjectFiles(e.target.files);
    } else {
      setProjectFiles(null);
    }
  };

  // Handle ignore files selection
  const handleIgnoreFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setIgnoreFiles(e.target.files);
    } else {
      setIgnoreFiles(null);
    }
  };

  // Handle start over
  const handleStartOver = () => {
    if (projectInputRef.current) projectInputRef.current.value = "";
    if (ignoreInputRef.current) ignoreInputRef.current.value = "";
    setProjectFiles(null);
    setIgnoreFiles(null);
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
      showCustomAlert("Please select a project folder.");
      return;
    }

    // Determine the root folder name from the project input
    const firstFilePath = projectFiles[0].webkitRelativePath;
    const rootFolder = firstFilePath.split('/')[0];
    setRootFolderName(rootFolder);

    // Build an array of ignore folder names from the ignore input
    const ignoreFolders = new Set<string>();
    if (ignoreFiles) {
      for (let i = 0; i < ignoreFiles.length; i++) {
        const parts = ignoreFiles[i].webkitRelativePath.split('/');
        if (parts.length > 0) {
          ignoreFolders.add(parts[0]);
        }
      }
    }
    
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

  // Handle downloading the generated README file directly in the frontend
  const handleGenerateReadme = (e: React.FormEvent) => {
    e.preventDefault();
    if (!structure || !rootFolderName) {
      showCustomAlert("Missing structure or folder name.");
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
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-6 px-4 shadow-md">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold flex items-center">
            <FileText className="mr-2" />
            README Generator
          </h1>
          <p className="mt-2 opacity-90">Generate comprehensive README files from your project structure</p>
        </div>
      </header>

      {/* Custom Alert */}
      {alert.show && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50 animate-fade-in-down">
          <AlertTriangle className="mr-2" />
          <span>{alert.message}</span>
          <button 
            onClick={() => setAlert({ show: false, message: "" })}
            className="ml-3 text-white"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto py-8 px-4">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Panel */}
          <div className="w-full md:w-2/5">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Project Configuration</h2>
              
              {/* Project Folder Selection */}
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Project Folder</label>
                <div className="flex items-center">
                  <input 
                    type="file" 
                    id="projectFiles" 
                    ref={projectInputRef}
                    onChange={handleProjectFilesChange}
                    webkitdirectory="true"
                    directory=""
                    multiple
                    required
                    className="hidden"
                  />
                  <label 
                    htmlFor="projectFiles"
                    className="flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition cursor-pointer"
                  >
                    <FolderOpen size={18} className="mr-2" />
                    Select Folder
                  </label>
                  {projectFiles && (
                    <button 
                      onClick={() => {
                        if (projectInputRef.current) projectInputRef.current.value = "";
                        setProjectFiles(null);
                      }}
                      className="ml-2 p-2 text-gray-500 hover:text-red-500 transition"
                      title="Clear selection"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                
                {projectFiles && (
                  <div className="mt-3 bg-gray-50 rounded-md border border-gray-200 p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{getRootFolderName(projectFiles)}</div>
                        <div className="text-sm text-gray-600">{getFileCount(projectFiles)} files</div>
                      </div>
                      <button 
                        onClick={() => setProjectExpanded(!projectExpanded)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {projectExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                    
                    {projectExpanded && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-sm bg-gray-100 p-2 rounded">
                        <pre className="text-xs text-gray-600">
                          {Array.from(projectFiles).slice(0, 100).map((file, index) => (
                            <div key={index}>{file.webkitRelativePath}</div>
                          ))}
                          {projectFiles.length > 100 && <div>... and {projectFiles.length - 100} more files</div>}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Ignore Folders Selection */}
              <div className="mb-6">
                <label className="block text-gray-700 font-medium mb-2">Folders to Ignore (Optional)</label>
                <div className="flex items-center">
                  <input 
                    type="file" 
                    id="ignoreFiles" 
                    ref={ignoreInputRef}
                    onChange={handleIgnoreFilesChange}
                    webkitdirectory="true"
                    directory=""
                    multiple
                    className="hidden"
                  />
                  <label 
                    htmlFor="ignoreFiles"
                    className="flex items-center justify-center px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition cursor-pointer"
                  >
                    <FolderX size={18} className="mr-2" />
                    Select Ignore Folders
                  </label>
                  {ignoreFiles && (
                    <button 
                      onClick={() => {
                        if (ignoreInputRef.current) ignoreInputRef.current.value = "";
                        setIgnoreFiles(null);
                      }}
                      className="ml-2 p-2 text-gray-500 hover:text-red-500 transition"
                      title="Clear selection"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
                
                {ignoreFiles && (
                  <div className="mt-3 bg-gray-50 rounded-md border border-gray-200 p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="font-medium">{getRootFolderName(ignoreFiles)}</div>
                        <div className="text-sm text-gray-600">{getFileCount(ignoreFiles)} files</div>
                      </div>
                      <button 
                        onClick={() => setIgnoreExpanded(!ignoreExpanded)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        {ignoreExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>
                    
                    {ignoreExpanded && (
                      <div className="mt-2 max-h-40 overflow-y-auto text-sm bg-gray-100 p-2 rounded">
                        <pre className="text-xs text-gray-600">
                          {ignoreFiles && Array.from(ignoreFiles).slice(0, 100).map((file, index) => (
                            <div key={index}>{file.webkitRelativePath}</div>
                          ))}
                          {ignoreFiles && ignoreFiles.length > 100 && <div>... and {ignoreFiles.length - 100} more files</div>}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="mt-2 text-sm text-gray-600">
                  <p>Note: node_modules, .git, and .DS_Store are automatically ignored</p>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex space-x-3">
                <button 
                  onClick={handlePreview}
                  className="flex-1 flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
                  disabled={!projectFiles}
                >
                  <Eye size={18} className="mr-2" />
                  Preview Structure
                </button>
                <button 
                  onClick={handleStartOver}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 transition flex items-center"
                >
                  <RefreshCw size={18} className="mr-2" />
                  Reset
                </button>
              </div>
              
              {/* Progress Bar */}
              {showProgress && (
                <div className="mt-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Processing Files</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div 
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Right Panel */}
          <div className="w-full md:w-3/5">
            <div className="bg-white rounded-lg shadow-md p-6 h-full">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Preview of Project Structure</h2>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 h-[400px] overflow-y-auto font-mono text-sm">
                <pre className="whitespace-pre-wrap">{previewContent}</pre>
              </div>
              
              {showGenerateButton && (
                <div className="mt-6 text-center">
                  <button 
                    onClick={handleGenerateReadme}
                    className="px-6 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition inline-flex items-center"
                  >
                    <FileText size={18} className="mr-2" />
                    Generate README
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <p>README Generator Tool &copy; {new Date().getFullYear()}</p>
          <p className="text-sm mt-2 text-gray-400">A tool to help you document your projects better</p>
        </div>
      </footer>
    </div>
  );
}

export default App;