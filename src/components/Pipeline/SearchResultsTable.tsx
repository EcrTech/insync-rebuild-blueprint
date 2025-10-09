import { useNavigate } from "react-router-dom";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

interface SearchResultsTableProps {
  contacts: any[];
}

const SearchResultsTable = ({ contacts }: SearchResultsTableProps) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Pipeline Stage</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contacts.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
                No contacts found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell className="font-medium">
                  {contact.first_name} {contact.last_name}
                </TableCell>
                <TableCell>{contact.company || '-'}</TableCell>
                <TableCell>{contact.email || '-'}</TableCell>
                <TableCell>{contact.phone || '-'}</TableCell>
                <TableCell>
                  {contact.pipeline_stages ? (
                    <Badge
                      style={{
                        backgroundColor: contact.pipeline_stages.color,
                        color: '#ffffff',
                      }}
                    >
                      {contact.pipeline_stages.name}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/contacts/${contact.id}`)}
                  >
                    View
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default SearchResultsTable;
