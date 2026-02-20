const { jsPDF } = require("jspdf");
console.log("Resolving jspdf:", require.resolve("jspdf"));
try {
  const doc = new jsPDF();
  console.log(
    "Output function includes cdnjs:",
    doc.output.toString().includes("cdnjs.cloudflare.com"),
  );
  console.log("Output function source length:", doc.output.toString().length);
} catch (e) {
  console.error(e);
}
