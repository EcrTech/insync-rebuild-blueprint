import { supabase } from "@/integrations/supabase/client";

export interface TemplateVariable {
  variable: string; // "{{1}}" or "{{first_name}}"
  label?: string;
  isRequired: boolean;
}

export interface CRMField {
  key: string;
  label: string;
  type: 'standard' | 'custom';
}

export function detectTemplateVariables(
  templateContent: string,
  headerContent?: string,
  footerText?: string
): TemplateVariable[] {
  const fullContent = [templateContent, headerContent, footerText]
    .filter(Boolean)
    .join(' ');

  const variables: TemplateVariable[] = [];
  const seen = new Set<string>();

  // Match {{1}}, {{2}}, etc. (WhatsApp style)
  const numberedMatches = fullContent.match(/\{\{\d+\}\}/g) || [];
  numberedMatches.forEach(match => {
    if (!seen.has(match)) {
      seen.add(match);
      variables.push({
        variable: match,
        label: `Variable ${match.replace(/[{}]/g, '')}`,
        isRequired: true
      });
    }
  });

  // Match {{word}} (Email style)
  const namedMatches = fullContent.match(/\{\{[a-z_][a-z0-9_]*\}\}/gi) || [];
  namedMatches.forEach(match => {
    if (!seen.has(match)) {
      seen.add(match);
      const fieldName = match.replace(/[{}]/g, '');
      variables.push({
        variable: match,
        label: fieldName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        isRequired: true
      });
    }
  });

  return variables.sort((a, b) => {
    const aNum = a.variable.match(/\d+/);
    const bNum = b.variable.match(/\d+/);
    if (aNum && bNum) return parseInt(aNum[0]) - parseInt(bNum[0]);
    return a.variable.localeCompare(b.variable);
  });
}

export async function getCRMFields(
  orgId: string,
  includeCustomFields: boolean = true
): Promise<{
  standardFields: CRMField[];
  customFields: CRMField[];
}> {
  const standardFields: CRMField[] = [
    { key: 'first_name', label: 'First Name', type: 'standard' },
    { key: 'last_name', label: 'Last Name', type: 'standard' },
    { key: 'email', label: 'Email', type: 'standard' },
    { key: 'phone', label: 'Phone', type: 'standard' },
    { key: 'company', label: 'Company', type: 'standard' },
    { key: 'job_title', label: 'Job Title', type: 'standard' },
    { key: 'city', label: 'City', type: 'standard' },
    { key: 'state', label: 'State', type: 'standard' },
    { key: 'country', label: 'Country', type: 'standard' },
  ];

  let customFields: CRMField[] = [];

  if (includeCustomFields) {
    try {
      const { data, error } = await supabase
        .from('custom_fields')
        .select('field_name, field_label')
        .eq('org_id', orgId)
        .eq('is_active', true)
        .order('field_order');

      if (!error && data) {
        customFields = data.map(field => ({
          key: field.field_name,
          label: field.field_label,
          type: 'custom' as const
        }));
      }
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  }

  return { standardFields, customFields };
}

export interface VariableMapping {
  source: 'crm' | 'csv' | 'static';
  field?: string; // CRM field name or CSV column name
  value?: string; // Static value
}

export function replaceVariables(
  template: string,
  contact: any,
  customData: Record<string, any>,
  variableMappings: Record<string, VariableMapping>,
  csvColumnMapping?: Record<string, string> // Maps CRM field keys to CSV column names
): string {
  let result = template;

  for (const [variable, mapping] of Object.entries(variableMappings)) {
    let value = '';

    if (mapping.source === 'crm') {
      value = contact[mapping.field!] || '';
    } else if (mapping.source === 'csv') {
      // First try direct CSV column access
      value = customData[mapping.field!] || '';
      // If not found and we have column mapping, try the mapped column
      if (!value && csvColumnMapping && mapping.field) {
        const mappedColumn = csvColumnMapping[mapping.field];
        if (mappedColumn) {
          value = customData[mappedColumn] || '';
        }
      }
    } else if (mapping.source === 'static') {
      value = mapping.value || '';
    }

    // Escape regex special characters in variable for replacement
    const escapedVariable = variable.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedVariable, 'g'), value);
  }

  return result;
}
