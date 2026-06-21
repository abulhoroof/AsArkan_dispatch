import { jsPDF } from 'jspdf';
import { InvoiceLineItem } from '@/config/contractProfiles';
import { SettlementAdjustment } from '@/components/DriverFinance/SettlementAdjustments';
import { formatCurrency, formatRate } from '@/utils/settlementCalculations';
import { format } from 'date-fns';

interface SettlementPdfData {
  driverName: string;
  driverContractType: string;
  invoiceNumber: string;
  startDate: Date;
  endDate: Date;
  lineItems: InvoiceLineItem[];
  deductions: SettlementAdjustment[];
  reimbursements: SettlementAdjustment[];
  totalNetPay: number;
  totalDeductions: number;
  totalReimbursements: number;
  grandTotal: number;
  payLogic: 'PERCENTAGE' | 'MILEAGE';
  rate: number;
}

export function generateSettlementPdf(data: SettlementPdfData): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // Helper functions
  const addText = (text: string, x: number, yPos: number, options?: { 
    fontSize?: number; 
    fontStyle?: 'normal' | 'bold';
    align?: 'left' | 'center' | 'right';
  }) => {
    const { fontSize = 10, fontStyle = 'normal', align = 'left' } = options || {};
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', fontStyle);
    
    let xPos = x;
    if (align === 'center') {
      xPos = pageWidth / 2;
    } else if (align === 'right') {
      xPos = pageWidth - margin;
    }
    
    doc.text(text, xPos, yPos, { align });
  };

  const addLine = (yPos: number) => {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // Header
  addText('SETTLEMENT STATEMENT', margin, y, { fontSize: 18, fontStyle: 'bold' });
  y += 8;
  addText(`Invoice #: ${data.invoiceNumber}`, margin, y);
  addText(`Generated: ${format(new Date(), 'MMM d, yyyy')}`, 0, y, { align: 'right' });
  y += 12;
  
  addLine(y);
  y += 10;

  // Contractor Details Section
  addText('CONTRACTOR DETAILS', margin, y, { fontSize: 12, fontStyle: 'bold' });
  y += 8;
  
  addText(`Driver: ${data.driverName}`, margin, y);
  y += 6;
  addText(`Contract Type: ${data.driverContractType}`, margin, y);
  y += 6;
  addText(`Default Rate: ${formatRate(data.payLogic, data.rate)}`, margin, y);
  y += 6;
  addText(`Period: ${format(data.startDate, 'MMM d, yyyy')} - ${format(data.endDate, 'MMM d, yyyy')}`, margin, y);
  y += 12;

  addLine(y);
  y += 10;

  // Load Revenue Section
  addText('LOAD REVENUE', margin, y, { fontSize: 12, fontStyle: 'bold' });
  y += 8;

  if (data.lineItems.length === 0) {
    addText('No loads for this period.', margin, y);
    y += 8;
  } else {
    // Table headers - adjusted column positions for 4 columns
    const colDesc = margin;
    const colRate = margin + 70;
    const colAmount = pageWidth - 70;
    const colNetPay = pageWidth - margin;

    doc.setFillColor(240, 240, 240);
    doc.rect(margin, y - 4, pageWidth - 2 * margin, 8, 'F');
    
    addText('Description', colDesc, y, { fontStyle: 'bold' });
    addText('Rate', colRate, y, { fontStyle: 'bold' });
    addText(data.payLogic === 'PERCENTAGE' ? 'Total' : 'Miles', colAmount - 5, y, { fontStyle: 'bold' });
    addText('Net Pay', colNetPay, y, { fontStyle: 'bold', align: 'right' });
    y += 8;

    // Table rows
    for (const item of data.lineItems) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      const description = item.description || (item.loadNumber ? `Load #${item.loadNumber}` : 'Load');
      addText(description, colDesc, y);
      
      // Display the applied rate for this load
      const rateDisplay = item.appliedRate || (item.payLogic === 'PERCENTAGE' 
        ? `${item.rate}%` 
        : `$${item.rate.toFixed(2)}/mi`);
      addText(rateDisplay, colRate, y);
      
      const amountValue = item.payLogic === 'PERCENTAGE' 
        ? formatCurrency(item.grossAmount || 0)
        : `${item.milesDriven?.toLocaleString() || 0} mi`;
      addText(amountValue, colAmount - 5, y);
      addText(formatCurrency(item.netPay), colNetPay, y, { align: 'right' });
      y += 6;
    }

    y += 4;
    addLine(y);
    y += 6;
    
    addText(`Total Loads (${data.lineItems.length}):`, margin, y, { fontStyle: 'bold' });
    addText(formatCurrency(data.totalNetPay), colNetPay, y, { fontStyle: 'bold', align: 'right' });
    y += 12;
  }

  addLine(y);
  y += 10;

  // Adjustments Section
  addText('ADJUSTMENTS', margin, y, { fontSize: 12, fontStyle: 'bold' });
  y += 8;

  const colRight = pageWidth - margin;

  // Deductions
  if (data.deductions.length > 0) {
    addText('Deductions:', margin, y, { fontStyle: 'bold' });
    y += 6;
    
    for (const deduction of data.deductions) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      addText(`  ${deduction.description || 'Deduction'}`, margin, y);
      addText(`-${formatCurrency(deduction.amount)}`, colRight, y, { align: 'right' });
      y += 6;
    }
    y += 4;
  }

  // Reimbursements
  if (data.reimbursements.length > 0) {
    addText('Reimbursements:', margin, y, { fontStyle: 'bold' });
    y += 6;
    
    for (const reimbursement of data.reimbursements) {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      addText(`  ${reimbursement.description || 'Reimbursement'}`, margin, y);
      addText(`+${formatCurrency(reimbursement.amount)}`, colRight, y, { align: 'right' });
      y += 6;
    }
    y += 4;
  }

  if (data.deductions.length === 0 && data.reimbursements.length === 0) {
    addText('No adjustments for this period.', margin, y);
    y += 8;
  }

  y += 4;
  addLine(y);
  y += 10;

  // Summary Section
  addText('SUMMARY', margin, y, { fontSize: 12, fontStyle: 'bold' });
  y += 10;

  const summaryX = pageWidth / 2 + 10;
  const summaryValueX = pageWidth - margin;
  
  doc.setFillColor(248, 250, 252);
  doc.rect(summaryX - 5, y - 6, pageWidth - summaryX - margin + 10, 36, 'F');

  addText('Total Loads:', summaryX, y);
  addText(formatCurrency(data.totalNetPay), summaryValueX, y, { align: 'right' });
  y += 8;

  addText('Total Reimbursements:', summaryX, y);
  addText(`+${formatCurrency(data.totalReimbursements)}`, summaryValueX, y, { align: 'right' });
  y += 8;

  addText('Total Deductions:', summaryX, y);
  addText(`-${formatCurrency(data.totalDeductions)}`, summaryValueX, y, { align: 'right' });
  y += 10;

  doc.setDrawColor(0, 0, 0);
  doc.line(summaryX - 5, y - 2, summaryValueX, y - 2);
  
  addText('GRAND TOTAL:', summaryX, y + 4, { fontSize: 12, fontStyle: 'bold' });
  addText(formatCurrency(data.grandTotal), summaryValueX, y + 4, { fontSize: 12, fontStyle: 'bold', align: 'right' });

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(128, 128, 128);
  doc.text(`Settlement Statement for ${data.driverName} | Generated on ${format(new Date(), 'MMM d, yyyy h:mm a')}`, margin, y);

  // Generate filename and download
  const periodStr = `${format(data.startDate, 'MMMd')}-${format(data.endDate, 'MMMd_yyyy')}`;
  const safeDriverName = data.driverName.replace(/[^a-zA-Z0-9]/g, '');
  const filename = `Settlement_${safeDriverName}_${periodStr}.pdf`;
  
  doc.save(filename);
}
