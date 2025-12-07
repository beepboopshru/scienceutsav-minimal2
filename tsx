            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedAssignments(new Set())}>
                Clear Selection
              </Button>
              <Button onClick={handleRequestInventory}>
                Request Inventory
              </Button>
            </div>