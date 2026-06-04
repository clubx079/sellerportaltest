'use client'
import { FileText } from 'lucide-react'

function Fill({ value }) {
  if (value !== undefined && value !== null && String(value).trim() !== '') {
    return <span className="font-semibold text-[#1A1816]">{value}</span>
  }
  return <span className="inline-block align-baseline bg-[#FEF9E7] border-b border-[#E0B100] rounded-[1px]" style={{ minWidth: '64px', height: '0.95em' }}>&#8203;</span>
}

export default function LiveContractPreview({ isAssignment, buyerName, sellerName, fieldValues: fv, fullPage = false }) {
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const money = (v) => (v !== '' && v != null && !Number.isNaN(Number(v))) ? `$${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : null
  const longDate = (v) => v ? (() => { try { return new Date(v).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) } catch { return v } })() : null
  const funds = fv.financing_type ? (fv.financing_type === 'cash' ? 'Cash' : 'Financing') : null

  const body = (
    <>
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className={`${fullPage ? 'text-[15px]' : 'text-[12px]'} font-bold uppercase tracking-wide`}>{isAssignment ? 'Assignment of Sale Contract Agreement' : 'Contract to Purchase Real Estate'}</h3>
        <span className={`${fullPage ? 'text-[13px]' : 'text-[11px]'} font-extrabold text-[#D03839] shrink-0`} style={{ fontFamily: 'DM Sans, sans-serif' }}>DeelMap</span>
      </div>

      {isAssignment ? (
        <>
          <p className="mb-1">Property Address: <Fill value={fv.property_address} /></p>
          <p className="mb-2">This agreement is made this <Fill value={today} />, by and between <Fill value={sellerName} /> (Assignor) and <Fill value={buyerName} /> (Assignee) regarding the sale of the above referenced property.</p>
          <p className="mb-1.5">Whereas <Fill value={sellerName} /> (Assignor) has entered into a Purchase and Sale Contract with <Fill value={fv.original_seller_name} /> (Seller) on <Fill value={longDate(fv.original_psa_date)} /> for the purchase of subject property.</p>
          <p className="mb-1.5 text-[#444441]">Whereas, Assignor wishes to assign its rights, interests and obligations in the Purchase and Sale Contract to Assignee for the final purchase of subject property.</p>
          <p className="mb-1.5">Now therefore, it is hereby agreed between Assignor and Assignee as follows:</p>
          <p className="mb-1.5"><b>1) ASSIGNMENT FEE:</b> Assignee shall pay Assignor an assignment fee of <Fill value={money(fv.purchase_price)} /> of which <Fill value={money(fv.emd)} /> shall be paid upon execution and shall represent a nonrefundable deposit. The balance shall be payable to Assignor at time of closing.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">2) INSPECTION PERIOD:</b> Assignee waives any inspection period contained in the attached contract. All inspections have been completed prior to the execution of this agreement.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">3) OWNERSHIP &amp; PROPERTY ACCESS ACKNOWLEDGMENT:</b> Assignee acknowledges that Assignor does not authorize Assignee to enter the Subject Property without Assignor&rsquo;s direct authorization, and holds Assignor harmless from related liability.</p>
          <p className="mb-1.5 text-[#444441]">Assignee agrees and accepts all terms and conditions of the subject contract for Purchase and Sale between Buyer and Seller in its entirety.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">4) LIMITATION OF ASSIGNMENT:</b> This Agreement and the subject contract are not assignable by Assignee without the written consent of the Assignor.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">5) DISCLOSURES &amp; ACKNOWLEDGMENT:</b> Assignor makes no warranty regarding inspection or other reports. Assignee is dealing directly with Assignor, is not represented by a real estate agent, and acknowledges receipt of the original Purchase and Sale Contract and all addendums.</p>
          <p className="mb-1.5"><b>6) CLOSING DATE:</b> The closing date of the subject transaction shall be <Fill value={longDate(fv.closing_date)} />.</p>
          <p className="mb-3"><b>7) ADDITIONAL TERMS:</b> <Fill value={fv.special_terms} /></p>
          <p className="mb-3 text-[#444441]">All other terms and conditions of the Subject Purchase and Sale Contract not specifically amended hereby or inconsistent herewith shall remain in full force and effect.</p>
          <p className="font-bold mb-2">AGREED AND ACCEPTED</p>
          <div className="space-y-1.5 pt-2 border-t border-[#E8E8E4]">
            <p>Assignor: <Fill value={null} /> &nbsp;&nbsp; Date: <Fill value={null} /></p>
            <p>Print Name: <Fill value={sellerName} /></p>
            <p className="pt-1">Assignee: <Fill value={null} /> &nbsp;&nbsp; Date: <Fill value={null} /></p>
            <p>Print Name: <Fill value={buyerName} /></p>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2">This contract dated: <Fill value={today} /> in which Buyer: <Fill value={buyerName} /> whose address is <Fill value={fv.buyer_address} /> and/or assigns (the &ldquo;BUYER&rdquo;) and Seller: <Fill value={sellerName} /> whose address is <Fill value={fv.seller_address} /> (the &ldquo;SELLER&rdquo;) hereby agree that the SELLER will sell and BUYER will buy the following described real estate:</p>
          <p className="mb-1">ADDRESS(s): <Fill value={fv.property_address} /></p>
          <p className="mb-1">PROPERTY TAX ID(s): <Fill value={fv.property_tax_id} /></p>
          <p className="mb-2">OTHER DESCRIPTION (if applicable): <Fill value={fv.other_description} /></p>
          <p className="mb-2 text-[#444441]">together with all fixtures, all electrical, mechanical, plumbing, HVAC, and any other systems as are currently installed or attached thereto, together with all the improvements thereon and all appurtenances thereto, all being hereinafter collectively referred to as the &ldquo;Property.&rdquo;</p>
          <p className="font-bold underline mb-1.5">SELLER AGREES:</p>
          <p className="mb-1.5"><b>1) SALE PRICE:</b> <Fill value={money(fv.purchase_price)} />, <b>SOURCE OF FUNDS</b> (cash/financing): <Fill value={funds} /></p>
          <p className="mb-1.5"><b>2) DEPOSIT:</b> Upon acceptance Buyer will submit an earnest money deposit of <Fill value={money(fv.emd)} /> to <Fill value={fv.emd_escrow} /> which will be credited to the BUYER when sale closes. This deposit will be returned to the BUYER if the title does not transfer in accordance with this agreement.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">3) CLOSING COSTS &amp; TAXES:</b> BUYER pays all closing costs, deed prep, and title insurance. Current year taxes are prorated at closing; any previous year&rsquo;s taxes and/or transfer tax to be paid by SELLER.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">4) RENTS &amp; DEPOSITS (if applicable):</b> Rents are prorated at closing and transfer to the BUYER. Tenant deposits per the existing lease also transfer to the BUYER at closing.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">5) TITLE &amp; JUDGMENTS:</b> Seller warrants there are no judgments threatening the equity in the property and no bankruptcy pending. Title is to be free, clear, and unencumbered; all liens shall be paid at closing by the seller.</p>
          <p className="mb-1.5"><b>6) DUE DILIGENCE PERIOD:</b> BUYER has <Fill value={fv.due_diligence_days} /> days to perform due diligence following the SELLER&rsquo;s acceptance. The BUYER may cancel for any reason during this period and receive a full return of earnest money.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">7) CONDITION:</b> Property is sold &ldquo;AS-IS&rdquo; with no warranties by the SELLER, who will disclose any known material defects. Appliances remain with the property unless otherwise stated.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">8) POSSESSION:</b> Possession and occupancy, with all keys and openers, will be delivered to the BUYER when title transfers.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">9) ASSIGNABILITY:</b> This purchase contract IS assignable. SELLER agrees the buyer may place signs and market the property immediately upon acceptance by both parties.</p>
          <p className="mb-1.5"><b>10) ACCEPTANCE:</b> This instrument becomes binding when accepted by the Seller and signed by both parties. If it is not accepted and signed by the Seller on or prior to <Fill value={longDate(fv.acceptance_deadline)} />, this contract shall be void.</p>
          <p className="mb-1.5"><b>11) CLOSING:</b> Closing will take place on or before <Fill value={longDate(fv.closing_date)} /> subject to a 90-day period to clear any title problems. Closing will take place at <Fill value={fv.closing_location} />.</p>
          <p className="mb-1.5 text-[#444441]"><b className="text-[#1A1816]">12) TIME IS OF THE ESSENCE:</b> Time is of the essence; relevant time periods are calculated in business days.</p>
          <p className="mb-3"><b>13) ADDITIONAL TERMS (if applicable):</b> <Fill value={fv.special_terms} /></p>
          <div className="space-y-2 pt-2 border-t border-[#E8E8E4]">
            <p>BUYER Print: <Fill value={buyerName} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p>
            <p>SELLER Print: <Fill value={sellerName} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p>
            {fv.co_seller_name ? <p>SELLER Print: <Fill value={fv.co_seller_name} /> &nbsp;&nbsp; Sign/Date: <Fill value={null} /></p> : null}
          </div>
        </>
      )}
    </>
  )

  if (fullPage) {
    return (
      <div className="px-8 py-10 sm:px-12 sm:py-14 text-[13px] leading-[1.7] text-[#1A1816]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}>
        {body}
      </div>
    )
  }

  return (
    <div className="bg-white border border-[#E8E8E4] rounded shadow-sm overflow-hidden">
      <div className="px-4 py-2 bg-[#FAFAF8] border-b border-[#E8E8E4] flex items-center gap-2">
        <FileText className="w-3.5 h-3.5 text-[#737370]" />
        <span className="text-[11px] font-semibold text-[#737370] uppercase tracking-wide" style={{ fontFamily: 'DM Sans, sans-serif' }}>Live preview · the actual contract, filling in as you type</span>
      </div>
      <div className="px-6 py-5 max-h-[74vh] overflow-y-auto text-[11px] leading-[1.55] text-[#1A1816]" style={{ fontFamily: 'Georgia, "Times New Roman", serif', textAlign: 'justify' }}>
        {body}
      </div>
    </div>
  )
}
