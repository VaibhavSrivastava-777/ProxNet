async function test() {
  const guesses = ["swiggy", "zomato", "dell", "nonexistentcompany1234"];
  for (const guess of guesses) {
    const url = `https://www.workable.com/api/accounts/${guess}?details=true`;
    console.log("Fetching:", url);
    try {
      const res = await fetch(url);
      console.log("Status:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("data keys:", Object.keys(data));
        console.log("jobs count:", data.jobs ? data.jobs.length : "no jobs key");
      }
    } catch (e) {
      console.error(e);
    }
  }
}
test();
