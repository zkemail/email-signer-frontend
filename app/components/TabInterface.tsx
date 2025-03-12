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
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-[#272727]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-6 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-white text-black"
                  : "bg-transparent text-gray-400 hover:text-gray-200"
              } ${
                tab.id === tabs[0].id ? "rounded-l-lg" : ""
              } ${
                tab.id === tabs[tabs.length - 1].id ? "rounded-r-lg" : ""
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
