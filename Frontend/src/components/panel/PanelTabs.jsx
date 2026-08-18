export default function PanelTabs({ tabs, active, onChange }) {
  return (
    <div className="panel-tabs">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={tab.key === active ? 'panel-tab panel-tab-active' : 'panel-tab'}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
