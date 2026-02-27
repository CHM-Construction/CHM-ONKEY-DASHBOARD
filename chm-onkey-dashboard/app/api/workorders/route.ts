import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.ONKEY_API_URL;
  const token = process.env.ONKEY_API_TOKEN;

  if (!url || !token) {
    return NextResponse.json({ error: "Missing environment variables." });
  }

  // DIAGNOSTIC 1: Print the exact URL to the terminal so we can see what Next.js sees
  console.log("===================================");
  console.log("ATTEMPTING TO FETCH FROM:");
  console.log(url);
  console.log("===================================");

  try {
    const response = await fetch(url, {
      headers: {
        'Authorization': token,
        'Accept': 'application/json',
      },
      cache: 'no-store'
    });

    const textData = await response.text();

    if (!textData) {
        return NextResponse.json({ error: "Empty response", status: response.status });
    }

    let jsonData;
    try {
        jsonData = JSON.parse(textData);
    } catch (e) {
        return NextResponse.json({ error: "Not JSON", raw: textData.substring(0, 200) });
    }

    if (!jsonData.items) {
        return NextResponse.json({ error: "No items array", data: jsonData });
    }

    return NextResponse.json(jsonData.items);

  } catch (error: any) {
    // DIAGNOSTIC 2: Did the connection completely fail?
    console.error("FETCH ERROR:", error.message);
    return NextResponse.json({ 
      error: "The server crashed while fetching.", 
      details: error.message,
      firewallWarning: "If details say 'fetch failed', On Key is likely blocking GitHub Codespace IP addresses."
    });
  }
}