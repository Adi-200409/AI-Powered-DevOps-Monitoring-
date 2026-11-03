import React, { useState } from 'react';
import { useDevOpsData } from './hooks/useDevOpsData';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import OverviewPage from './components/OverviewPage';
import OperationsPage from './components/OperationsPage';

export default function App() {
  const [activeNavTab, setActiveNavTab] = useState('overview');
  const {
    systemStatus,
    metrics,
    metricsHistory,
    metricsHistoryError,
    logs,
    incidents,
    errorIntelligence,
    deployments,
    selectedIncidentId,
    setSelectedIncidentId,
    activeIncident,
    backendConnected,
    endpointStatus,
    isRefreshing,
    lastUpdated,
    pollInterval,
    setPollInterval,
    cpuHistory,
    memoryHistory,
    fetchData,
    remediateIncident,
    triggerSimulation
  } = useDevOpsData();

  const pageLabels = {
    overview: 'Overview',
    monitoring: 'Live monitoring',
    logs: 'Log explorer',
    errors: 'Error intelligence',
    incidents: 'Incident management',
    rootcause: 'Root cause analysis',
    ai: 'AI troubleshooter',
    cicd: 'CI/CD pipelines',
    infrastructure: 'Infrastructure',
    services: 'Services & apps',
    alerts: 'Alerts & notifications',
    reporting: 'Reports & analytics',
    integrations: 'Integrations',
    settings: 'Settings'
  };

  const handleSimulate = (type = 'db_error') => {
    triggerSimulation(type);
    setActiveNavTab('incidents');
  };

  return (
    <div className="ops-app">
      <Sidebar activeTab={activeNavTab} onSelectTab={setActiveNavTab} onSimulate={handleSimulate} />

      <div className="ops-main">
        <TopBar
          pageTitle={pageLabels[activeNavTab] || 'Overview'}
          backendConnected={backendConnected}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          activeAlertCount={incidents.length}
          onRefresh={fetchData}
          onSimulate={handleSimulate}
          onOpenAlerts={() => setActiveNavTab('incidents')}
        />

        <main className="ops-content">
          {activeNavTab === 'overview' ? (
            <OverviewPage
              systemStatus={systemStatus}
              metrics={metrics}
              metricsHistory={metricsHistory}
              metricsHistoryError={metricsHistoryError}
              backendConnected={backendConnected}
              endpointStatus={endpointStatus}
              hasMetricHistory={cpuHistory.length > 0}
              logs={logs}
              incidents={incidents}
              deployments={deployments}
              selectedIncidentId={selectedIncidentId}
              onSelectIncident={setSelectedIncidentId}
              onNavigate={setActiveNavTab}
              cpuHistory={cpuHistory}
              memoryHistory={memoryHistory}
            />
          ) : (
            <OperationsPage
              activeTab={activeNavTab}
              systemStatus={systemStatus}
              metrics={metrics}
              metricsHistory={metricsHistory}
              metricsHistoryError={metricsHistoryError}
              backendConnected={backendConnected}
              endpointStatus={endpointStatus}
              hasMetricHistory={cpuHistory.length > 0}
              logs={logs}
              incidents={incidents}
              errorIntelligence={errorIntelligence}
              deployments={deployments}
              selectedIncidentId={selectedIncidentId}
              activeIncident={activeIncident}
              onSelectIncident={setSelectedIncidentId}
              isRefreshing={isRefreshing}
              onRefresh={fetchData}
              remediateIncident={remediateIncident}
              pollInterval={pollInterval}
              setPollInterval={setPollInterval}
            />
          )}
        </main>
      </div>
    </div>
  );
}
