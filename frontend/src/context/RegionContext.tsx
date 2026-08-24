"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { CloudProvider, DEFAULT_PROVIDER, DEFAULT_REGIONS, GLOBAL_REGION, getRegionsForProvider, isCloudProvider } from "@/lib/regions";

const STORAGE_KEY = "rabbittize_region";
const PROVIDER_STORAGE_KEY = "rabbittize_cloud_provider";
const providerRegionKey = (provider: CloudProvider) => `${STORAGE_KEY}_${provider}`;

interface RegionContextValue {
    selectedProvider: CloudProvider;
    setSelectedProvider: (provider: CloudProvider) => void;
    selectedRegion: string;
    setSelectedRegion: (region: string) => void;
}

const RegionContext = createContext<RegionContextValue>({
    selectedProvider: DEFAULT_PROVIDER,
    setSelectedProvider: () => { },
    selectedRegion: GLOBAL_REGION,
    setSelectedRegion: () => { },
});

export function RegionProvider({ children }: { children: React.ReactNode }) {
    const [selectedProvider, setSelectedProviderState] = useState<CloudProvider>(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(PROVIDER_STORAGE_KEY);
            if (stored && isCloudProvider(stored)) return stored;
        }
        return DEFAULT_PROVIDER;
    });

    // Initialise directly from localStorage to avoid a wrong-region first render
    const [selectedRegion, setSelectedRegionState] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const storedProvider = localStorage.getItem(PROVIDER_STORAGE_KEY);
            const provider = storedProvider && isCloudProvider(storedProvider) ? storedProvider : DEFAULT_PROVIDER;
            const stored = localStorage.getItem(providerRegionKey(provider)) || localStorage.getItem(STORAGE_KEY);
            if (stored) return stored;
        }
        return GLOBAL_REGION;
    });

    const setSelectedRegion = useCallback((region: string) => {
        setSelectedRegionState(region);
        localStorage.setItem(STORAGE_KEY, region);
        localStorage.setItem(providerRegionKey(selectedProvider), region);
    }, [selectedProvider]);

    const setSelectedProvider = useCallback((provider: CloudProvider) => {
        setSelectedProviderState(provider);
        localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
        const storedRegion = localStorage.getItem(providerRegionKey(provider));
        const providerRegions = getRegionsForProvider(provider);
        const currentRegionSupported = selectedRegion === GLOBAL_REGION || providerRegions.some(region => region.value === selectedRegion);
        const nextRegion = storedRegion || (currentRegionSupported ? selectedRegion : DEFAULT_REGIONS[provider]);
        setSelectedRegionState(nextRegion);
        localStorage.setItem(STORAGE_KEY, nextRegion);
        localStorage.setItem(providerRegionKey(provider), nextRegion);
    }, [selectedRegion]);

    // Sync across tabs
    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) {
                setSelectedRegionState(e.newValue);
            }
            if (e.key === PROVIDER_STORAGE_KEY && e.newValue && isCloudProvider(e.newValue)) {
                setSelectedProviderState(e.newValue);
                const region = localStorage.getItem(providerRegionKey(e.newValue)) || DEFAULT_REGIONS[e.newValue];
                setSelectedRegionState(region);
            }
        };
        window.addEventListener("storage", handler);
        return () => window.removeEventListener("storage", handler);
    }, []);

    return (
        <RegionContext.Provider value={{ selectedProvider, setSelectedProvider, selectedRegion, setSelectedRegion }}>
            {children}
        </RegionContext.Provider>
    );
}

export function useRegion() {
    return useContext(RegionContext);
}
