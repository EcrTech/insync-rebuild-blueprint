import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrgContext } from "@/hooks/useOrgContext";
import { useNotification } from "@/hooks/useNotification";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/Layout/DashboardLayout";
import FilterRow from "@/components/Pipeline/FilterRow";
import SearchResultsTable from "@/components/Pipeline/SearchResultsTable";
import { Plus, Search, X } from "lucide-react";

export interface SearchableField {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'email' | 'phone' | 'boolean';
  isCustomField: boolean;
  options?: string[];
  category: 'basic' | 'contact_info' | 'business' | 'location' | 'pipeline' | 'custom';
}

export interface Filter {
  id: string;
  fieldId: string;
  operator: string;
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

const PipelineAdvancedSearch = () => {
  const navigate = useNavigate();
  const { effectiveOrgId } = useOrgContext();
  const { success: showSuccess, error: showError } = useNotification();
  const [fields, setFields] = useState<SearchableField[]>([]);
  const [filters, setFilters] = useState<Filter[]>([{ id: '1', fieldId: '', operator: '', value: '' }]);
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Load available fields
  useEffect(() => {
    const loadFields = async () => {
      if (!effectiveOrgId) return;

      setIsLoading(true);
      try {
        // Standard contact fields
        const standardFields: SearchableField[] = [
          { id: 'first_name', name: 'first_name', label: 'First Name', type: 'text', isCustomField: false, category: 'basic' },
          { id: 'last_name', name: 'last_name', label: 'Last Name', type: 'text', isCustomField: false, category: 'basic' },
          { id: 'email', name: 'email', label: 'Email', type: 'email', isCustomField: false, category: 'contact_info' },
          { id: 'phone', name: 'phone', label: 'Phone', type: 'phone', isCustomField: false, category: 'contact_info' },
          { id: 'company', name: 'company', label: 'Company', type: 'text', isCustomField: false, category: 'business' },
          { id: 'job_title', name: 'job_title', label: 'Job Title', type: 'text', isCustomField: false, category: 'business' },
          { id: 'source', name: 'source', label: 'Source', type: 'text', isCustomField: false, category: 'basic' },
          { id: 'status', name: 'status', label: 'Status', type: 'text', isCustomField: false, category: 'basic' },
          { id: 'city', name: 'city', label: 'City', type: 'text', isCustomField: false, category: 'location' },
          { id: 'state', name: 'state', label: 'State', type: 'text', isCustomField: false, category: 'location' },
          { id: 'country', name: 'country', label: 'Country', type: 'text', isCustomField: false, category: 'location' },
          { id: 'postal_code', name: 'postal_code', label: 'Postal Code', type: 'text', isCustomField: false, category: 'location' },
          { id: 'created_at', name: 'created_at', label: 'Created Date', type: 'date', isCustomField: false, category: 'basic' },
        ];

        // Load custom fields
        const { data: customFields } = await supabase
          .from('custom_fields')
          .select('*')
          .eq('org_id', effectiveOrgId)
          .eq('is_active', true)
          .order('field_order');

        const customFieldsMapped: SearchableField[] = (customFields || []).map(cf => ({
          id: cf.id,
          name: cf.field_name,
          label: cf.field_label,
          type: cf.field_type === 'textarea' ? 'text' : cf.field_type as any,
          isCustomField: true,
          options: cf.field_options as string[] || undefined,
          category: 'custom',
        }));

        setFields([...standardFields, ...customFieldsMapped]);
      } catch (error) {
        console.error('Error loading fields:', error);
        showError("Failed to load search fields");
      } finally {
        setIsLoading(false);
      }
    };

    loadFields();
  }, [effectiveOrgId]);

  const addFilter = () => {
    setFilters([...filters, { id: Date.now().toString(), fieldId: '', operator: '', value: '' }]);
  };

  const removeFilter = (id: string) => {
    if (filters.length > 1) {
      setFilters(filters.filter(f => f.id !== id));
    }
  };

  const updateFilter = (id: string, updates: Partial<Filter>) => {
    setFilters(filters.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const clearAllFilters = () => {
    setFilters([{ id: '1', fieldId: '', operator: '', value: '' }]);
    setResults([]);
  };

  const executeSearch = async () => {
    if (!effectiveOrgId) return;

    // Validate filters
    const validFilters = filters.filter(f => f.fieldId && f.operator && (
      f.operator === 'is_empty' || f.operator === 'is_not_empty' || f.value
    ));

    if (validFilters.length === 0) {
      showError("Please add at least one complete filter");
      return;
    }

    setIsSearching(true);
    try {
      // Execute search with filters
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('org_id', effectiveOrgId)
        .limit(1000);

      if (error) throw error;

      let filteredContacts = contacts || [];

      // Apply all filters (standard and custom) to the results
      for (const filter of validFilters) {
        const field = fields.find(f => f.id === filter.fieldId);
        if (!field) continue;

        if (field.isCustomField) {
          // Handle custom field filtering
          const contactIds = filteredContacts.map(c => c.id);
          const { data: customFieldValues } = await supabase
            .from('contact_custom_fields')
            .select('contact_id, field_value')
            .eq('custom_field_id', filter.fieldId)
            .in('contact_id', contactIds);

          let matchingContactIds: string[] = [];

          switch (filter.operator) {
            case 'contains':
              matchingContactIds = (customFieldValues || [])
                .filter(cfv => cfv.field_value?.toLowerCase().includes(filter.value.toLowerCase()))
                .map(cfv => cfv.contact_id);
              break;
            case 'equals':
              matchingContactIds = (customFieldValues || [])
                .filter(cfv => cfv.field_value === filter.value)
                .map(cfv => cfv.contact_id);
              break;
            case 'greater_than':
              matchingContactIds = (customFieldValues || [])
                .filter(cfv => parseFloat(cfv.field_value) > parseFloat(filter.value))
                .map(cfv => cfv.contact_id);
              break;
            case 'less_than':
              matchingContactIds = (customFieldValues || [])
                .filter(cfv => parseFloat(cfv.field_value) < parseFloat(filter.value))
                .map(cfv => cfv.contact_id);
              break;
            case 'between':
              if (filter.value?.from && filter.value?.to) {
                matchingContactIds = (customFieldValues || [])
                  .filter(cfv => {
                    const val = parseFloat(cfv.field_value);
                    return val >= parseFloat(filter.value.from) && val <= parseFloat(filter.value.to);
                  })
                  .map(cfv => cfv.contact_id);
              }
              break;
            case 'is_empty':
              const existingIds = new Set((customFieldValues || []).map(cfv => cfv.contact_id));
              matchingContactIds = contactIds.filter(id => !existingIds.has(id));
              break;
            case 'is_not_empty':
              matchingContactIds = (customFieldValues || []).map(cfv => cfv.contact_id);
              break;
          }

          filteredContacts = filteredContacts.filter(c => matchingContactIds.includes(c.id));
        } else {
          // Handle standard field filtering
          filteredContacts = filteredContacts.filter(contact => {
            const fieldValue = contact[field.name as keyof typeof contact];
            
            switch (filter.operator) {
              case 'contains':
                return String(fieldValue || '').toLowerCase().includes(String(filter.value).toLowerCase());
              case 'not_contains':
                return !String(fieldValue || '').toLowerCase().includes(String(filter.value).toLowerCase());
              case 'equals':
                return fieldValue === filter.value;
              case 'not_equals':
                return fieldValue !== filter.value;
              case 'starts_with':
                return String(fieldValue || '').toLowerCase().startsWith(String(filter.value).toLowerCase());
              case 'ends_with':
                return String(fieldValue || '').toLowerCase().endsWith(String(filter.value).toLowerCase());
              case 'greater_than':
                return Number(fieldValue) > Number(filter.value);
              case 'less_than':
                return Number(fieldValue) < Number(filter.value);
              case 'between':
                if (filter.value?.from && filter.value?.to) {
                  const val = Number(fieldValue);
                  return val >= Number(filter.value.from) && val <= Number(filter.value.to);
                }
                return true;
              case 'is_empty':
                return !fieldValue;
              case 'is_not_empty':
                return !!fieldValue;
              default:
                return true;
            }
          });
        }
      }

      setResults(filteredContacts);
      showSuccess(`Found ${filteredContacts.length} contacts`);
    } catch (error) {
      console.error('Search error:', error);
      showError("An error occurred while searching");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Advanced Search</h1>
            <p className="text-muted-foreground mt-1">Build complex queries to find contacts</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/pipeline')}>
            <X className="h-4 w-4 mr-2" />
            Close
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Filter Builder</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <p className="text-muted-foreground">Loading fields...</p>
            ) : (
              <>
                {filters.map((filter, index) => (
                  <div key={filter.id}>
                    <FilterRow
                      filter={filter}
                      fields={fields}
                      onUpdate={(updates) => updateFilter(filter.id, updates)}
                      onRemove={() => removeFilter(filter.id)}
                      canRemove={filters.length > 1}
                    />
                    {index < filters.length - 1 && (
                      <div className="flex items-center justify-center my-2">
                        <span className="text-sm font-medium text-muted-foreground bg-muted px-3 py-1 rounded">
                          AND
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={addFilter}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Filter
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearAllFilters}>
                    Clear All
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button onClick={executeSearch} disabled={isSearching} className="flex-1">
            <Search className="h-4 w-4 mr-2" />
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Results ({results.length} contacts)</CardTitle>
            </CardHeader>
            <CardContent>
              <SearchResultsTable contacts={results} />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default PipelineAdvancedSearch;
