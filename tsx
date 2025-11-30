  return (
    <Layout>
      <div className="p-8 space-y-6">
        <motion.div ...>
          <div>...</div>

          <Tabs ...>
            <TabsList>...</TabsList>

            <TabsContent value="procurement">
               {/* ... existing content ... */}
            </TabsContent>

            <TabsContent value="requests">
              <MaterialRequestsTab />
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>

      <Dialog ...>
      {/* ... */}
