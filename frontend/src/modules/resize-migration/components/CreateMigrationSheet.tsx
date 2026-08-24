import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomDateTimePicker } from "@/components/ui/custom-datetime-picker";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Activity, Clock, Database, Info, Server, Zap } from "@/icons";
import { MigrationListPanelProps } from "./MigrationListPanel.types";

type Props = Pick<
  MigrationListPanelProps,
  | "isCreateOpen"
  | "setIsCreateOpen"
  | "provider"
  | "setProvider"
  | "region"
  | "setRegion"
  | "sources"
  | "isLoadingSources"
  | "selectedSourceId"
  | "setSelectedSourceId"
  | "targetSizes"
  | "isLoadingTargetSizes"
  | "selectedTargetType"
  | "setSelectedTargetType"
  | "cutoverMode"
  | "setCutoverMode"
  | "dnsHostedZoneId"
  | "setDnsHostedZoneId"
  | "dnsZoneName"
  | "setDnsZoneName"
  | "dnsResourceGroupName"
  | "setDnsResourceGroupName"
  | "dnsDomainName"
  | "setDnsDomainName"
  | "dnsRecordType"
  | "setDnsRecordType"
  | "dnsTtl"
  | "setDnsTtl"
  | "isScheduled"
  | "setIsScheduled"
  | "scheduledTime"
  | "setScheduledTime"
  | "accessMode"
  | "setAccessMode"
  | "accessMethod"
  | "setAccessMethod"
  | "sshUsername"
  | "setSshUsername"
  | "sshPort"
  | "setSshPort"
  | "sshKey"
  | "setSshKey"
  | "activeRegions"
  | "filteredSources"
  | "handleCreateJob"
  | "getRegionLabel"
>;

export function CreateMigrationSheet({
  isCreateOpen,
  setIsCreateOpen,
  provider,
  setProvider,
  region,
  setRegion,
  sources,
  isLoadingSources,
  selectedSourceId,
  setSelectedSourceId,
  targetSizes,
  isLoadingTargetSizes,
  selectedTargetType,
  setSelectedTargetType,
  cutoverMode,
  setCutoverMode,
  dnsHostedZoneId,
  setDnsHostedZoneId,
  dnsZoneName,
  setDnsZoneName,
  dnsResourceGroupName,
  setDnsResourceGroupName,
  dnsDomainName,
  setDnsDomainName,
  dnsRecordType,
  setDnsRecordType,
  dnsTtl,
  setDnsTtl,
  isScheduled,
  setIsScheduled,
  scheduledTime,
  setScheduledTime,
  accessMode,
  setAccessMode,
  accessMethod,
  setAccessMethod,
  sshUsername,
  setSshUsername,
  sshPort,
  setSshPort,
  sshKey,
  setSshKey,
  activeRegions,
  filteredSources,
  handleCreateJob,
  getRegionLabel,
}: Props) {
  return (
    <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
      <SheetContent
        showCloseButton={true}
        className="sm:max-w-[768px] w-full md:w-[768px] p-0 border-l border-slate-200 dark:border-slate-800 shadow-2xl bg-white dark:bg-[#0A1220] flex flex-col h-full focus:outline-none"
      >
        <SheetHeader className="border-b border-slate-100 dark:border-slate-800 p-5 text-left bg-slate-50 dark:bg-[#0f172a]/20 shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-500" />
            <span className="text-lg font-extrabold text-slate-900 dark:text-white">
              Plan Server Resize Migration
            </span>
          </SheetTitle>
          <SheetDescription className="text-xs font-semibold text-slate-500 mt-1">
            Choose your provider instance, region, and target server
            specifications.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Plan Configuration Form */}
            <div className="space-y-4 pr-1">
              {/* Provider Selection */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Provider
                </Label>
                <Select
                  value={provider}
                  onValueChange={(val: any) => {
                    setProvider(val);
                    setRegion("");
                    setSelectedSourceId("");
                  }}
                >
                  <SelectTrigger className="h-10 text-xs font-extrabold">
                    <SelectValue placeholder="Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">
                      Amazon Web Services (AWS)
                    </SelectItem>
                    <SelectItem value="azure">
                      Microsoft Azure (Azure)
                    </SelectItem>
                    <SelectItem value="gcp">
                      Google Cloud Platform (GCP)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Region */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Region
                </Label>
                <Select
                  value={region}
                  onValueChange={(val) => {
                    setRegion(val);
                    setSelectedSourceId("");
                    setSelectedTargetType("");
                  }}
                  disabled={activeRegions.length === 0}
                >
                  <SelectTrigger className="h-10 text-xs font-extrabold">
                    <SelectValue
                      placeholder={
                        isLoadingSources
                          ? "Scanning regions..."
                          : "Select Region"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {activeRegions.length > 0 ? (
                      activeRegions.map((reg) => (
                        <SelectItem key={reg} value={reg}>
                          {getRegionLabel(provider, reg)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>
                        {isLoadingSources
                          ? "Scanning..."
                          : "run a server from our simulation"}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Source Instance */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Source Server
                </Label>
                <SearchableSelect
                  value={selectedSourceId}
                  onValueChange={(val) => setSelectedSourceId(val)}
                  disabled={isLoadingSources || filteredSources.length === 0}
                  placeholder={
                    isLoadingSources
                      ? "Scanning servers..."
                      : !region
                      ? "Select region first"
                      : filteredSources.length === 0
                      ? "No running instances found"
                      : "Select Source Server"
                  }
                  searchPlaceholder="Search by name, ID, or type..."
                  options={filteredSources.map((s) => ({
                    value: s.id,
                    label: s.name || s.id.substring(0, 15) + "...",
                    description: `${s.type} • ${
                      s.privateIp || "No Private IP"
                    }`,
                    badge: s.state,
                  }))}
                />
              </div>

              {/* Target Size */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Target Server Size
                </Label>
                <SearchableSelect
                  value={selectedTargetType}
                  onValueChange={(val) => setSelectedTargetType(val)}
                  disabled={isLoadingTargetSizes || !selectedSourceId}
                  placeholder={
                    isLoadingTargetSizes
                      ? "Querying sizes..."
                      : !selectedSourceId
                      ? "Select source server first"
                      : "Select Target Size"
                  }
                  searchPlaceholder="Search sizes (e.g. t3, standard)..."
                  options={targetSizes.map((t) => ({
                    value: t.instanceType,
                    label: t.instanceType,
                    description: `${t.vCpu} vCPUs • ${t.memoryGb} GB RAM`,
                    badge: t.category,
                  }))}
                />
              </div>

              {/* Cutover mode */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Cutover Mode
                </Label>
                <Select
                  value={cutoverMode}
                  onValueChange={(val: any) => setCutoverMode(val)}
                >
                  <SelectTrigger className="h-10 text-xs font-extrabold">
                    <SelectValue placeholder="Cutover Strategy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      Manual / DNS cutover instructions
                    </SelectItem>
                    <SelectItem value="elastic_ip">
                      {provider === "azure"
                        ? "Public IP Address Transfer"
                        : "Elastic IP Swap (Automatic)"}
                    </SelectItem>
                    <SelectItem value="dns">
                      Automatic DNS Rerouting
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Initial access mode */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Initial Access Mode
                </Label>
                <Select
                  value={accessMode}
                  onValueChange={(val: any) => setAccessMode(val)}
                >
                  <SelectTrigger className="h-10 text-xs font-extrabold">
                    <SelectValue placeholder="Access Mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cloud_only">
                      Cloud-Only Mode (Default)
                    </SelectItem>
                    <SelectItem value="deep_inspection">
                      Deep Inspection Mode
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Scheduled Migration Settings */}
              <div className="space-y-2.5 border-t border-slate-100 dark:border-slate-800/80 pt-3.5">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="scheduleCheckbox"
                    checked={isScheduled}
                    onChange={(e) => setIsScheduled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-blue-600 cursor-pointer"
                  />
                  <Label
                    htmlFor="scheduleCheckbox"
                    className="text-xs font-extrabold text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                  >
                    Schedule Migration Execution
                  </Label>
                </div>
                {isScheduled && (
                  <div className="space-y-1.5 pt-1">
                    <Label className="text-[10px] font-bold text-[#64748b]">
                      Scheduled Date & Time
                    </Label>
                    <CustomDateTimePicker
                      value={scheduledTime}
                      onChange={setScheduledTime}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Visual Summary Preview Card */}
            <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/10 border border-slate-100 dark:border-slate-800/60 rounded-xl p-5 justify-between min-h-[380px]">
              <div>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mb-4">
                  <Activity className="h-4 w-4" />
                  Live Migration Preview
                </h3>

                {selectedSourceId ? (
                  <div className="space-y-5">
                    {/* Visual Flow chart (Source -> Target) */}
                    <div className="flex flex-col items-center justify-center py-4 bg-white dark:bg-slate-900/30 rounded-xl border border-slate-100 dark:border-slate-800/40 p-4 shadow-sm">
                      {/* Source Server Card */}
                      <div className="w-full">
                        <div className="bg-slate-50/60 dark:bg-slate-950/20 border border-slate-100 dark:border-slate-800/80 p-3 rounded-lg flex items-center gap-2.5">
                          <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
                            <Server className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-extrabold text-[#64748b] dark:text-[#94a3b8]/70 uppercase tracking-widest">
                              Source Server
                            </p>
                            <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                              {sources.find((s) => s.id === selectedSourceId)
                                ?.name || "Instance"}
                            </h4>
                            <p className="text-[10px] font-semibold text-slate-500 dark:text-[#94a3b8]/60 truncate">
                              {sources.find((s) => s.id === selectedSourceId)
                                ?.type || "Unknown Type"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Pulsing Connecting Line */}
                      <div className="my-2.5 flex flex-col items-center justify-center h-8 relative w-full">
                        <div className="w-0.5 h-full border-l-2 border-dashed border-slate-200 dark:border-slate-800"></div>
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white p-1.5 rounded-full shadow-md animate-pulse">
                          <Zap className="h-3 w-3" />
                        </div>
                      </div>

                      {/* Target Server Card */}
                      <div className="w-full">
                        <div
                          className={`border p-3 rounded-lg flex items-center gap-2.5 transition-all ${
                            selectedTargetType
                              ? "bg-blue-50/10 dark:bg-blue-950/5 border-blue-200/50 dark:border-blue-900/30 shadow-sm"
                              : "bg-slate-50/30 dark:bg-slate-955/5 border-slate-100 dark:border-slate-800/40 border-dashed"
                          }`}
                        >
                          <div
                            className={`p-2 rounded shrink-0 ${
                              selectedTargetType
                                ? "bg-blue-100/60 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400"
                                : "bg-slate-100 dark:bg-slate-900 text-[#64748b]"
                            }`}
                          >
                            <Database className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[9px] font-extrabold text-[#64748b] dark:text-[#94a3b8]/70 uppercase tracking-widest">
                              Target Server Size
                            </p>
                            <h4
                              className={`text-xs font-bold truncate ${
                                selectedTargetType
                                  ? "text-slate-800 dark:text-slate-200"
                                  : "text-slate-400 dark:text-slate-600"
                              }`}
                            >
                              {selectedTargetType || "Select Target Size"}
                            </h4>
                            {selectedTargetType &&
                              targetSizes.find(
                                (t) => t.instanceType === selectedTargetType
                              ) && (
                                <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                  {(() => {
                                    const t = targetSizes.find(
                                      (ts) =>
                                        ts.instanceType === selectedTargetType
                                    );
                                    return t
                                      ? `${t.vCpu} vCPUs, ${t.memoryGb} GB RAM`
                                      : "";
                                  })()}
                                </p>
                              )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Spec Comparison Details */}
                    <div className="space-y-2.5 bg-white dark:bg-slate-900/30 p-4 rounded-xl border border-slate-100 dark:border-slate-800/40 shadow-sm">
                      <div className="flex justify-between items-center text-xs border-b border-slate-50 dark:border-slate-900/40 pb-2">
                        <span className="font-semibold text-[#64748b]">
                          Cutover Strategy
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {cutoverMode === "manual"
                            ? "Manual / DNS"
                            : cutoverMode === "elastic_ip"
                            ? provider === "azure"
                              ? "IP Transfer"
                              : "Elastic IP Swap"
                            : "Auto DNS Reroute"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-b border-slate-50 dark:border-slate-900/40 pb-2">
                        <span className="font-semibold text-[#64748b]">
                          Initial Access Mode
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200">
                          {accessMode === "cloud_only"
                            ? "Cloud-Only"
                            : "Deep Inspection"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-[#64748b]">
                          Scheduled Time
                        </span>
                        <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                          {isScheduled && scheduledTime
                            ? new Date(scheduledTime).toLocaleString([], {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "Immediate Run"}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Empty State */
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-xl bg-white/50 dark:bg-slate-900/10">
                    <div className="p-3 bg-slate-100 dark:bg-slate-900/60 text-slate-400 dark:text-slate-500 rounded-full mb-3 shadow-inner">
                      <Zap className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      No Server Selected
                    </h4>
                    <p className="text-[10px] text-[#64748b] dark:text-[#94a3b8]/70 mt-1 max-w-[220px] leading-normal font-semibold">
                      Select a provider, region, and source server to preview
                      the migration map.
                    </p>
                  </div>
                )}
              </div>

              {/* Informational Warning / Note */}
              <div className="mt-4 p-3 bg-blue-50/15 dark:bg-blue-900/10 border border-blue-100/30 dark:border-blue-900/20 rounded-lg flex gap-2">
                <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <p className="text-[10px] font-semibold text-slate-655 dark:text-slate-400 leading-normal">
                  Resizing will snapshot your source server volume, create a
                  new target VM, and copy configurations. Source data remains
                  completely unmodified.
                </p>
              </div>
            </div>
          </div>

          {/* DNS Cutover Settings */}
          {cutoverMode === "dns" && (
            <div className="space-y-3 border border-indigo-100 bg-indigo-50/15 p-4 rounded-xl dark:border-indigo-900/30 dark:bg-indigo-950/10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 block mb-1">
                DNS Cutover Settings
              </span>
              {provider === "aws" ? (
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-[#64748b]">
                    Route 53 Hosted Zone ID
                  </Label>
                  <Input
                    value={dnsHostedZoneId}
                    onChange={(e) => setDnsHostedZoneId(e.target.value)}
                    className="h-9 text-xs font-semibold"
                    placeholder="e.g. Z0123456789ABCDEF"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#64748b]">
                      Azure DNS Zone Name
                    </Label>
                    <Input
                      value={dnsZoneName}
                      onChange={(e) => setDnsZoneName(e.target.value)}
                      className="h-9 text-xs font-semibold"
                      placeholder="e.g. mycompany.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#64748b]">
                      Azure DNS Resource Group
                    </Label>
                    <Input
                      value={dnsResourceGroupName}
                      onChange={(e) =>
                        setDnsResourceGroupName(e.target.value)
                      }
                      className="h-9 text-xs font-semibold"
                      placeholder="e.g. dns-resources-rg"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#64748b]">
                  Domain Name (FQDN)
                </Label>
                <Input
                  value={dnsDomainName}
                  onChange={(e) => setDnsDomainName(e.target.value)}
                  className="h-9 text-xs font-semibold"
                  placeholder="e.g. app.mycompany.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-[#64748b]">
                    Record Type
                  </Label>
                  <Select
                    value={dnsRecordType}
                    onValueChange={setDnsRecordType}
                  >
                    <SelectTrigger className="h-9 text-xs font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">A Record (IPv4)</SelectItem>
                      <SelectItem value="AAAA">AAAA Record (IPv6)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-[#64748b]">
                    TTL (Seconds)
                  </Label>
                  <Input
                    type="number"
                    value={dnsTtl}
                    onChange={(e) => setDnsTtl(Number(e.target.value))}
                    className="h-9 text-xs font-semibold"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Initial access configuration details for deep inspection */}
          {accessMode === "deep_inspection" && (
            <div className="space-y-3 border border-slate-100 dark:border-slate-800 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/30">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                  Method
                </Label>
                <Select
                  value={provider === "azure" ? "ssh" : accessMethod}
                  onValueChange={(val: any) => setAccessMethod(val)}
                >
                  <SelectTrigger className="h-9 text-xs font-extrabold">
                    <SelectValue placeholder="Method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ssh">SSH Private Key</SelectItem>
                    {provider === "aws" && (
                      <SelectItem value="ssm">
                        AWS Systems Manager (SSM)
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {accessMethod === "ssh" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                      Username
                    </Label>
                    <Input
                      value={sshUsername}
                      onChange={(e) => setSshUsername(e.target.value)}
                      className="h-9 text-xs font-semibold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                      SSH Port
                    </Label>
                    <Input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(Number(e.target.value))}
                      className="h-9 text-xs font-semibold"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label className="text-[10px] font-extrabold uppercase tracking-widest text-[#64748b]">
                      Private Key (.pem)
                    </Label>
                    <Textarea
                      value={sshKey}
                      onChange={(e) => setSshKey(e.target.value)}
                      placeholder="Paste private key content..."
                      className="text-xs font-mono h-20"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800/80 p-5 bg-slate-50 dark:bg-[#0f172a]/20 flex gap-3 shrink-0">
          <Button
            variant="outline"
            className="flex-1 h-11 text-xs font-extrabold rounded-xl"
            onClick={() => setIsCreateOpen(false)}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 text-xs font-extrabold bg-[#2563eb] hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20"
            onClick={handleCreateJob}
            disabled={!selectedSourceId || !selectedTargetType}
          >
            Create Job
          </Button>
        </div>
      </SheetContent>
    </Sheet>

  );
}
