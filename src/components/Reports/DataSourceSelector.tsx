import { Card } from "@/components/ui/card";
import { DataSourceType, reportDataSources } from "@/config/reportDataSources";
import { Database, Users, Phone, BarChart3, Package, BookOpen } from "lucide-react";

interface DataSourceSelectorProps {
  selected: DataSourceType | null;
  onSelect: (dataSource: DataSourceType) => void;
}

const iconMap: Record<DataSourceType, any> = {
  contacts: Users,
  call_logs: Phone,
  activities: BarChart3,
  pipeline_stages: BarChart3,
  inventory: Package,
  data_repository: BookOpen,
};

export default function DataSourceSelector({ selected, onSelect }: DataSourceSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Select Data Source</h3>
      <div className="grid grid-cols-2 gap-3">
        {Object.values(reportDataSources).map((source) => {
          const Icon = iconMap[source.key];
          const isSelected = selected === source.key;
          
          return (
            <Card
              key={source.key}
              className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                isSelected ? 'ring-2 ring-primary bg-accent' : ''
              }`}
              onClick={() => onSelect(source.key)}
            >
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                <div>
                  <p className="font-medium text-sm">{source.label}</p>
                  <p className="text-xs text-muted-foreground">{source.fields.length} fields</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
