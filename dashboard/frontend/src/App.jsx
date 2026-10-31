import React, { useState } from 'react';
import { useDevOpsData } from './hooks/useDevOpsData';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import TelemetryChart from './components/TelemetryChart';
import ServiceCards from './components/ServiceCards';
import RightSidebar from './components/RightSidebar';
import DiagnosticsModal from './components/DiagnosticsModal';

export default function App() {
  const [activeNavTab, setActiveNavTab] = useState('analytics');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialTab, setModalInitialTab] = useState('ai');

  const {
    systemStatus,
    metrics,
    logs,
    incidents,
    deployments,
    selectedIncidentId,
    setSelectedIncidentId,
    activeIncident,
    backendConnected,
    isRefreshing,
    lastUpdated,
    pollInterval,
    setPollInterval,
    cpuHistory,
    memoryHistory,
    fetchData,
    triggerSimulation
  } = useDevOpsData();

  const handleOpenDiagnostics = (tab = 'ai') => {
    setModalInitialTab(tab);
    setModalOpen(true);
  };

  const handleSimulateFromUI = (type = 'db_error') => {
    triggerSimulation(type);
    handleOpenDiagnostics('ai');
  };

  return (
    <div className="nixtio-app-layout">
      {/* 1. Left Navigation Rail (Floating Slim Sidebar) */}
      <Sidebar
        activeTab={activeNavTab}
        onSelectTab={(tab) => {
          setActiveNavTab(tab);
          if (tab === 'logs') handleOpenDiagnostics('logs');
          else if (tab === 'cicd') handleOpenDiagnostics('pipeline');
          else if (tab === 'alerts') handleOpenDiagnostics('slack');
          else if (tab === 'telemetry') handleOpenDiagnostics('ai');
          else if (tab === 'services') handleOpenDiagnostics('logs');
        }}
        onOpenLogs={() => handleOpenDiagnostics('logs')}
        onOpenTriage={() => handleOpenDiagnostics('ai')}
        onSimulate={() => handleSimulateFromUI('db_error')}
      />

      {/* 2. Main Work Area */}
      <div className="nixtio-main-wrapper">
        {/* Top Header Bar */}
        <TopBar
          isRefreshing={isRefreshing}
          onRefresh={fetchData}
          onSimulate={() => handleSimulateFromUI('db_error')}
          backendConnected={backendConnected}
          activeAlertCount={incidents.length}
        />

        {/* Content Columns: Left Main (Chart + Cards) & Right Sidebar */}
        <main className="nixtio-content-columns">
          {/* Center Column: System Workload Wave Chart + Monitored Services Cards */}
          <div className="center-analytics-column">
            {/* Wave Chart Section */}
            <TelemetryChart
              cpuHistory={cpuHistory}
              memoryHistory={memoryHistory}
            />

            {/* Monitored Microservices & Pipelines Section */}
            <ServiceCards
              systemStatus={systemStatus}
              onSelectService={(targetTab) => {
                handleOpenDiagnostics(targetTab);
              }}
            />
          </div>

          {/* Right Column: Active Incidents + SRE Operations + Sunset Gradient Banner */}
          <RightSidebar
            onOpenDetails={(targetTab) => {
              handleOpenDiagnostics(targetTab);
            }}
            activeIncidentCount={incidents.length}
          />
        </main>
      </div>

      {/* 3. Detailed SRE Diagnostics Modal (Groq AI, Code Context, Slack, Jenkins, Logs) */}
      <DiagnosticsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialTab={modalInitialTab}
        activeIncident={activeIncident}
        incidents={incidents}
        onSelectIncident={setSelectedIncidentId}
        deployments={deployments}
        logs={logs}
        onSimulate={triggerSimulation}
        isRefreshing={isRefreshing}
        onRefresh={fetchData}
      />
    </div>
  );
}
