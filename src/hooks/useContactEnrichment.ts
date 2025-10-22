import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNotification } from "./useNotification";

export interface EnrichmentResult {
  success: boolean;
  fieldsEnriched: number;
  creditsUsed: number;
  error?: string;
}

export interface BulkEnrichmentResult {
  success: boolean;
  enriched: number;
  failed: number;
  creditsUsed: number;
  total: number;
  error?: string;
}

export function useContactEnrichment() {
  const [enriching, setEnriching] = useState(false);
  const notify = useNotification();

  const enrichContact = async (
    contactId: string,
    options?: { revealPhoneNumber?: boolean; revealPersonalEmail?: boolean }
  ): Promise<EnrichmentResult> => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('enrich-contact', {
        body: {
          contactId,
          revealPhoneNumber: options?.revealPhoneNumber || false,
          revealPersonalEmail: options?.revealPersonalEmail || false,
        },
      });

      if (error) throw error;

      if (data.error) {
        notify.error("Enrichment failed", data.error);
        return { success: false, fieldsEnriched: 0, creditsUsed: 0, error: data.error };
      }

      notify.success(
        "Contact enriched successfully",
        `Updated ${data.fieldsEnriched} fields using ${data.creditsUsed} credits`
      );

      return {
        success: true,
        fieldsEnriched: data.fieldsEnriched,
        creditsUsed: data.creditsUsed,
      };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to enrich contact";
      notify.error("Enrichment failed", errorMessage);
      return { success: false, fieldsEnriched: 0, creditsUsed: 0, error: errorMessage };
    } finally {
      setEnriching(false);
    }
  };

  const bulkEnrichContacts = async (
    contactIds: string[],
    options?: { revealPhoneNumber?: boolean; revealPersonalEmail?: boolean }
  ): Promise<BulkEnrichmentResult> => {
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke('bulk-enrich-contacts', {
        body: {
          contactIds,
          revealPhoneNumber: options?.revealPhoneNumber || false,
          revealPersonalEmail: options?.revealPersonalEmail || false,
        },
      });

      if (error) throw error;

      if (data.error) {
        notify.error("Bulk enrichment failed", data.error);
        return {
          success: false,
          enriched: 0,
          failed: 0,
          creditsUsed: 0,
          total: 0,
          error: data.error,
        };
      }

      notify.success(
        "Bulk enrichment completed",
        `Enriched ${data.enriched}/${data.total} contacts. ${data.failed} failed. Used ${data.creditsUsed} credits.`
      );

      return {
        success: true,
        enriched: data.enriched,
        failed: data.failed,
        creditsUsed: data.creditsUsed,
        total: data.total,
      };
    } catch (error: any) {
      const errorMessage = error.message || "Failed to enrich contacts";
      notify.error("Bulk enrichment failed", errorMessage);
      return {
        success: false,
        enriched: 0,
        failed: 0,
        creditsUsed: 0,
        total: 0,
        error: errorMessage,
      };
    } finally {
      setEnriching(false);
    }
  };

  return {
    enriching,
    enrichContact,
    bulkEnrichContacts,
  };
}
