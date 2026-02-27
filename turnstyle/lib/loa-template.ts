export function generateLOA(data: {
  promoterName: string
  abn: string
  address: string
  promotionName: string
  authorisedPersonName: string
  agencyName: string
  position: string
  date: string
}): string {
  return `
${data.promoterName}
ABN ${data.abn}
${data.address}

Date: ${data.date}


Subject: Letter of Authority – ${data.promotionName}

I, ${data.authorisedPersonName}, of ${data.promoterName} (ABN ${data.abn}), hereby authorise ${data.agencyName} to prepare, lodge and manage any trade promotion permit applications and related correspondence with relevant Australian regulatory authorities in connection with the above promotion.

Signed for and on behalf of ${data.promoterName}.

Signature: ____________________

Name: ${data.authorisedPersonName}

Title: ${data.position}

Date: ___________
  `.trim()
}
