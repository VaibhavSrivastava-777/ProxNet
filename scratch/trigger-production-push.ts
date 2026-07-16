

async function main() {
  const url = "https://www.proxnet.in/api/admin/test-push?email=vaibhav.srivastava@iiml.org";
  console.log(`Triggering production push notification via: ${url}`);
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log("Production trigger response:", res.status, data);
  } catch (e) {
    console.error("Failed to trigger production endpoint:", e);
  }
}

main().catch(console.error);
