const { readFilesToContextTool } = default_api;
const fileContent = await readFilesToContextTool({
  file_paths: ["src/pages/B2BAssignments.tsx"],
  replace_files_in_context: true
});
