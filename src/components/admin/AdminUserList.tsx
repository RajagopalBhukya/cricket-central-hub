import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Users, Eye, Clock, Phone, Mail } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface UserWithBookings {
  id: string;
  full_name: string;
  phone_number: string;
  email?: string;
  last_active?: string;
  is_online?: boolean;
  booking_count?: number;
  created_at?: string;
}

interface AdminUserListProps {
  users: UserWithBookings[];
  onViewUser: (user: UserWithBookings) => void;
}

const AdminUserList = memo(({ users, onViewUser }: AdminUserListProps) => {
  return (
    <Card>
      <CardHeader className="py-3 sm:py-4">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          All Booking Users ({users.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 sm:p-4">
        <ScrollArea className="h-[300px] sm:h-[400px]">
          <div className="space-y-2">
            {users.length === 0 ? (
              <p className="text-center text-muted-foreground py-4 text-sm">No users found</p>
            ) : (
              users.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate text-sm sm:text-base">{user.full_name}</span>
                      <Badge 
                        variant={user.is_online ? "default" : "secondary"}
                        className="text-[10px] px-1.5"
                      >
                        {user.is_online ? "Online" : "Offline"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground mt-1">
                      {user.email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate max-w-[150px] sm:max-w-none">{user.email}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {user.phone_number}
                      </span>
                      {user.last_active && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3 flex-shrink-0" />
                          {formatDistanceToNow(new Date(user.last_active), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onViewUser(user)}
                    className="flex-shrink-0 text-xs"
                  >
                    <Eye className="w-3 h-3 mr-1" />
                    View Details
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
});

AdminUserList.displayName = "AdminUserList";

export default AdminUserList;
