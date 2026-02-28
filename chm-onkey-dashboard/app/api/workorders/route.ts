import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // 1. Extract query parameters forwarded from the client (nuqs)
  const searchParams = request.nextUrl.searchParams;
  const skip = searchParams.get('skip') || '0';
  const top = searchParams.get('top') || '50';
  const search = searchParams.get('search') || '';
  const status = searchParams.get('status') || 'All';

  // 2. Construct the highly optimized OData Server-Side Query
  let filterQuery = `properties/statusDescription ne 'Request to Cancel'`;
  
  if (status !== 'All') {
    filterQuery += ` and properties/statusDescription eq '${status}'`;
  }
  if (search) {
    // Push the search load onto the database indexing engine
    filterQuery += ` and (contains(tolower(properties/description), '${search.toLowerCase()}') or contains(tolower(properties/assetCode), '${search.toLowerCase()}'))`;
  }

  // Build the final upstream URL
  const ONKEY_URL = `https://core-za.onkey.app/api/tenants/vkbgroup/prd/Modules/WM/WorkOrders/?$top=${top}&$skip=${skip}&$filter=${encodeURIComponent(filterQuery)}&cid=1750243656100004&ct=true`;
  
  // 3. Access the secure, server-side-only token
  const ONKEY_TOKEN = process.env.ONKEY_API_TOKEN; 

  if (!ONKEY_TOKEN) return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });

  try {
    const response = await fetch(ONKEY_URL, {
      headers: { 'Authorization': ONKEY_TOKEN, 'Accept': 'application/json' },
      cache: 'no-store' 
    });
    
    if (!response.ok) throw new Error(`API failed with status: ${response.status}`);
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Proxy Forwarding Error:", error);
    return NextResponse.json({ error: "Failed to fetch data" }, { status: 502 });
  }
}