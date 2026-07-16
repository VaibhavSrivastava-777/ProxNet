

async function main() {
  const url = "https://www.proxnet.in/api/admin/diagnose-push?email=vaibhav.srivastava@iiml.org";
  console.log(`Triggering production push diagnostics via: ${url}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Production diagnostics response:", res.status, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to trigger production endpoint:", e);
  }
}

main().catch(console.error);
