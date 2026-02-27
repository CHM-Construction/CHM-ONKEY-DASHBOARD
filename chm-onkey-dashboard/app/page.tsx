"use client";

import { useEffect, useState } from "react";

// Define the shape of the On Key data we care about
type WorkOrder = {
  id: number;
  properties: {
    code: string;
    description: string;
    assetCode: string;
    assetDescription: string;
    statusDescription: string;
    workRequired: string;
    staffMemberContactDetailFullName: string;
  };
};

export default function Dashboard() {
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch data from our secure local API route
    fetch("/api/workorders")
      .then((res) => res.json())
      .then((data) => {
        // SAFETY CHECK: Is the data actually an array?
        if (Array.isArray(data)) {
          setWorkOrders(data);
        } else {
          // If it is an error object, log it to the console so we can see it
          console.error("API did not return a list! It returned:", data);
          setWorkOrders([]); // Set to empty list to prevent crash
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-xl font-semibold text-gray-500">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mr-4"></div>
        Loading On Key Data...
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-8 text-gray-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900">Live Maintenance Dashboard</h1>
            <p className="text-gray-500 mt-2">Pulling real-time from VKB Group On Key</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow border border-gray-100 font-medium text-blue-700">
            Total Orders: {workOrders.length}
          </div>
        </header>

        {/* CSS Grid for the Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workOrders && workOrders.length > 0 ? (
            workOrders.map((wo) => {
              const props = wo.properties;
              // Determine a color based on status
              const statusColor = 
                props.statusDescription === "Completed" ? "bg-green-100 text-green-800 border-green-200" :
                props.statusDescription === "Approved" ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                "bg-gray-100 text-gray-800 border-gray-200";

              return (
                <div key={wo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <span className="font-mono text-sm text-gray-400 font-semibold">{props.code}</span>
                    <span className={`text-xs px-3 py-1 rounded-full font-bold border ${statusColor}`}>
                      {props.statusDescription}
                    </span>
                  </div>
                  
                  <h2 className="text-xl font-bold mb-1 truncate" title={props.assetDescription}>
                    {props.assetDescription}
                  </h2>
                  <h3 className="text-sm text-blue-600 font-semibold mb-4">{props.assetCode}</h3>
                  
                  <p className="text-gray-600 text-sm mb-6 line-clamp-3">
                    {props.workRequired || props.description || "No description provided."}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-50">
                    <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Assigned To</p>
                    <p className="text-sm font-medium">{props.staffMemberContactDetailFullName || "Unassigned"}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full p-8 text-center text-red-500 bg-red-50 rounded-xl border border-red-100">
              No Work Orders found or there was an error fetching data. Please check your browser console (F12) for details!
            </div>
          )}
        </div>
      </div>
    </main>
  );
}