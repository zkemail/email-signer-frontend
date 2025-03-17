import { useState, ReactNode, useRef, useEffect } from "react";

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
  const [indicatorStyle, setIndicatorStyle] = useState({});
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Update the indicator position when active tab changes
  useEffect(() => {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);
    if (activeIndex >= 0 && tabRefs.current[activeIndex]) {
      const tabElement = tabRefs.current[activeIndex];
      setIndicatorStyle({
        width: `${tabElement?.offsetWidth}px`,
        transform: `translateX(${tabElement?.offsetLeft}px)`,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div className="w-full">
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border border-[#272727] relative">
          {/* Moving background indicator */}
          <div
            className="absolute top-0 bottom-0 bg-white rounded-lg transition-all duration-300 ease-in-out z-0"
            style={indicatorStyle}
          />

          {/* Tab buttons */}
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-6 text-sm font-semibold relative z-10 transition-colors duration-300 ${
                activeTab === tab.id
                  ? "text-black"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="tab-content mt-4">
        {tabs.find((tab) => tab.id === activeTab)?.content}
      </div>
    </div>
  );
}
