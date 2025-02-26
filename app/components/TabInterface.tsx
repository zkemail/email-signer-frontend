import { useState, ReactNode } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
}

interface TabInterfaceProps {
  tabs: Tab[];
  defaultTabId?: string;
}

export default function TabInterface({
  tabs,
  defaultTabId,
}: TabInterfaceProps) {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0].id);

  return (
    <div className="w-full">
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-2" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-4 text-sm font-medium rounded-t-lg ${
                activeTab === tab.id
                  ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 border-t border-l border-r border-gray-200 dark:border-gray-700"
                  : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="tab-content">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
