import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Loader2 } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export default function ImportZipCodes() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const { isAdmin, isLoading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate("/");
    }
  }, [isAdmin, roleLoading, navigate]);

  const handleImport = async () => {
    setIsImporting(true);
    setProgress('Reading CSV file...');
    
    try {
      // Read the CSV file
      const response = await fetch('/src/data/zip_codes_usa.csv');
      const csvData = await response.text();
      
      setProgress('Sending data to backend...');
      
      // Call the edge function
      const { data, error } = await supabase.functions.invoke('import-zip-codes', {
        body: { csvData }
      });
      
      if (error) throw error;
      
      setProgress(`Successfully imported ${data.imported} zip codes!`);
      toast.success(`Imported ${data.imported} zip codes successfully!`);
      
    } catch (error) {
      console.error('Import error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setProgress(`Error: ${errorMessage}`);
      toast.error(`Import failed: ${errorMessage}`);
    } finally {
      setIsImporting(false);
    }
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="container mx-auto p-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Import Zip Codes</CardTitle>
          <CardDescription>
            Import US zip code data into the database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4">
            <Button 
              onClick={handleImport} 
              disabled={isImporting}
              className="w-full"
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Start Import
                </>
              )}
            </Button>
            
            {progress && (
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm">{progress}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}