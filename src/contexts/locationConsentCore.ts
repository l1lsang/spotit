import { createContext, useContext } from 'react'

export const LocationConsentContext = createContext<(prompt: boolean) => Promise<boolean>>(async () => false)
export function useLocationConsent() { return useContext(LocationConsentContext) }
