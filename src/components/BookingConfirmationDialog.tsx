import { CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface BookingConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
}

const BookingConfirmationDialog = ({ open, onClose }: BookingConfirmationDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="sr-only">Booking Confirmed</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4 animate-pulse">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
          <h2 className="text-2xl font-bold text-green-600 mb-2">
            ✅ Booking Confirmed
          </h2>
          <p className="text-muted-foreground mb-6">
            Your booking has been confirmed by the admin!
          </p>
          <Button onClick={onClose} className="w-full max-w-xs">
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BookingConfirmationDialog;
