import { memo } from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

interface AdminUserSearchProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  placeholder?: string;
}

const AdminUserSearch = memo(({ 
  searchQuery, 
  onSearchChange, 
  placeholder = "Search by name, email, or phone..." 
}: AdminUserSearchProps) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
      <Input
        placeholder={placeholder}
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
});

AdminUserSearch.displayName = "AdminUserSearch";

export default AdminUserSearch;
