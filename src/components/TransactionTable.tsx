import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Trash2, Pencil, Check, X, Loader2, CalendarIcon } from 'lucide-react';
import { DriverTransaction, NewTransaction, TRANSACTION_CATEGORIES } from '@/hooks/useDriverTransactions';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TransactionTableProps {
  transactions: DriverTransaction[];
  onDelete: (id: string) => Promise<boolean>;
  onUpdate?: (id: string, updates: Partial<DriverTransaction>) => Promise<boolean>;
  onAdd?: (transaction: NewTransaction) => Promise<boolean>;
  isLoading?: boolean;
  newRowType?: 'deduction' | 'reimbursement' | null;
  onCancelNewRow?: () => void;
}

export function TransactionTable({
  transactions,
  onDelete,
  onUpdate,
  onAdd,
  isLoading = false,
  newRowType = null,
  onCancelNewRow,
}: TransactionTableProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    date: string;
    description: string;
    amount: string;
  }>({ date: '', description: '', amount: '' });

  // State for inline new row
  const [newRowValues, setNewRowValues] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    category: '',
    description: '',
    amount: '',
  });
  const [newRowDateOpen, setNewRowDateOpen] = useState(false);
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);

  const getCategoryLabel = (type: 'deduction' | 'reimbursement', categoryValue: string) => {
    const categories = TRANSACTION_CATEGORIES[type];
    const found = categories.find((c) => c.value === categoryValue);
    return found?.label || categoryValue;
  };

  const handleDelete = async () => {
    if (deleteId) {
      await onDelete(deleteId);
      setDeleteId(null);
    }
  };

  const startEditing = (tx: DriverTransaction) => {
    setEditingId(tx.id);
    setEditValues({
      date: tx.transaction_date,
      description: tx.description || '',
      amount: tx.amount.toString(),
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({ date: '', description: '', amount: '' });
  };

  const saveEditing = async () => {
    if (editingId && onUpdate) {
      await onUpdate(editingId, {
        transaction_date: editValues.date,
        description: editValues.description || null,
        amount: parseFloat(editValues.amount) || 0,
      });
      cancelEditing();
    }
  };

  // Handlers for inline new row
  const handleSaveNewRow = async () => {
    if (!newRowType || !newRowValues.category || !newRowValues.amount || !onAdd) {
      return;
    }
    setIsSavingNew(true);
    const success = await onAdd({
      transaction_date: newRowValues.date,
      transaction_type: newRowType,
      category: newRowValues.category,
      description: newRowValues.description || undefined,
      amount: parseFloat(newRowValues.amount) || 0,
    });
    setIsSavingNew(false);
    if (success) {
      onCancelNewRow?.();
      setNewRowValues({
        date: format(new Date(), 'yyyy-MM-dd'),
        category: '',
        description: '',
        amount: '',
      });
    }
  };

  const handleCancelNewRow = () => {
    onCancelNewRow?.();
    setNewRowValues({
      date: format(new Date(), 'yyyy-MM-dd'),
      category: '',
      description: '',
      amount: '',
    });
  };

  if (isLoading) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        Loading transactions...
      </div>
    );
  }

  // Show empty state only if no transactions AND no new row is being added
  if (transactions.length === 0 && !newRowType) {
    return (
      <div className="border rounded-lg p-8 text-center text-muted-foreground">
        No transactions found for this period.
      </div>
    );
  }

  return (
    <>
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Date</TableHead>
              <TableHead className="w-[100px]">Type</TableHead>
              <TableHead className="w-[140px]">Category</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right w-[120px]">Amount</TableHead>
              <TableHead className="w-[80px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Inline New Row */}
            {newRowType && (
              <TableRow
                className={cn(
                  'bg-muted/30',
                  newRowType === 'deduction'
                    ? 'border-l-2 border-l-red-500'
                    : 'border-l-2 border-l-green-500'
                )}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Popover open={newRowDateOpen} onOpenChange={setNewRowDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-7 w-28 justify-start text-left font-normal text-sm px-2"
                      >
                        <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                        {format(parseISO(newRowValues.date), 'MMM d')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={parseISO(newRowValues.date)}
                        onSelect={(date) => {
                          if (date) {
                            setNewRowValues((prev) => ({
                              ...prev,
                              date: format(date, 'yyyy-MM-dd'),
                            }));
                            setNewRowDateOpen(false);
                          }
                        }}
                        initialFocus
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-xs',
                      newRowType === 'deduction'
                        ? 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
                        : 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                    )}
                  >
                    {newRowType === 'deduction' ? '−' : '+'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={newRowValues.category}
                    onValueChange={(v) =>
                      setNewRowValues((prev) => ({ ...prev, category: v }))
                    }
                  >
                    <SelectTrigger className="h-7 text-sm w-32">
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSACTION_CATEGORIES[newRowType].map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Input
                    value={newRowValues.description}
                    onChange={(e) =>
                      setNewRowValues((prev) => ({ ...prev, description: e.target.value }))
                    }
                    className="h-7 text-sm"
                    placeholder="Description (optional)"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    value={newRowValues.amount}
                    onChange={(e) =>
                      setNewRowValues((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className={cn(
                      'h-7 text-sm w-24 ml-auto text-right',
                      newRowType === 'deduction' ? 'text-red-600' : 'text-green-600'
                    )}
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    autoFocus
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-green-600"
                      onClick={handleSaveNewRow}
                      disabled={isSavingNew || !newRowValues.category || !newRowValues.amount}
                    >
                      {isSavingNew ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground"
                      onClick={handleCancelNewRow}
                      disabled={isSavingNew}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )}

            {/* Existing Transactions */}
            {transactions.map((tx) => {
              const isEditing = editingId === tx.id;

              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-sm" onClick={(e) => e.stopPropagation()}>
                    {isEditing ? (
                      <Popover open={editDateOpen} onOpenChange={setEditDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-7 w-28 justify-start text-left font-normal text-sm px-2"
                          >
                            <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />
                            {format(parseISO(editValues.date), 'MMM d')}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start" sideOffset={4}>
                          <Calendar
                            mode="single"
                            selected={parseISO(editValues.date)}
                            onSelect={(date) => {
                              if (date) {
                                setEditValues((prev) => ({
                                  ...prev,
                                  date: format(date, 'yyyy-MM-dd'),
                                }));
                                setEditDateOpen(false);
                              }
                            }}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                    ) : (
                      format(parseISO(tx.transaction_date), 'MMM d')
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-xs',
                        tx.transaction_type === 'deduction'
                          ? 'border-red-300 text-red-700 dark:border-red-800 dark:text-red-400'
                          : 'border-green-300 text-green-700 dark:border-green-800 dark:text-green-400'
                      )}
                    >
                      {tx.transaction_type === 'deduction' ? '−' : '+'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {getCategoryLabel(tx.transaction_type, tx.category)}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={editValues.description}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, description: e.target.value }))
                        }
                        className="h-7 text-sm"
                        placeholder="Description"
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {tx.description || '—'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={editValues.amount}
                        onChange={(e) =>
                          setEditValues((prev) => ({ ...prev, amount: e.target.value }))
                        }
                        className="h-7 text-sm w-24 ml-auto text-right"
                        min={0}
                        step={0.01}
                      />
                    ) : (
                      <span
                        className={cn(
                          'font-medium',
                          tx.transaction_type === 'deduction'
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        )}
                      >
                        {tx.transaction_type === 'deduction' ? '−' : '+'}$
                        {tx.amount.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 justify-end">
                      {isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-green-600"
                            onClick={saveEditing}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground"
                            onClick={cancelEditing}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {onUpdate && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => startEditing(tx)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(tx.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Transaction?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this transaction. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
