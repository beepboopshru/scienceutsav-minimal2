                  // Standalone assignments
                  return batchAssignments.map((assignment, index) => (
                    <motion.tr
                      key={assignment._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="hover:bg-muted/50"
                    >
                      <TableCell>
                        <span className="text-sm text-muted-foreground">-</span>
                      </TableCell>
                      {editingAssignmentId === assignment._id ? (
                        <>
                          {/* Edit mode */}
                          {columnVisibility.program && (
                            <TableCell>
                              <Select value={editRowProgram} onValueChange={(val) => {
                                setEditRowProgram(val);
                                setEditRowKit("");
                              }}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {programs.map((program) => (
                                    <SelectItem key={program._id} value={program._id}>
                                      {program.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {columnVisibility.kit && (
                            <TableCell>
                              <Select value={editRowKit} onValueChange={setEditRowKit} disabled={!editRowProgram}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {editRowFilteredKits.map((kit) => (
                                    <SelectItem key={kit._id} value={kit._id}>
                                      {kit.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          )}
                          {columnVisibility.category && (
                            <TableCell>
                              <span className="text-sm text-muted-foreground">
                                variant="ghost"
                                onClick={() => handleStartEditRow(assignment)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteClick(assignment)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                              <Button onClick={handleSaveEditRow} size="sm">Save</Button>
                              <Button onClick={handleCancelEditRow} size="sm" variant="ghost">Cancel</Button>
                            </>
                          )}
                        </>
                      </TableCell>
                    </motion.tr>
                  ));

                  {/* Create Assignment Dialog */}
                  <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Create New Assignment</DialogTitle>
                        <DialogDescription>
                          Assign a kit to a client. Stock will be deducted immediately.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label>Program *</Label>
                          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select program" />
                            </SelectTrigger>
                            <SelectContent>
                              {programs.map((program) => (
                                <SelectItem key={program._id} value={program._id}>
                                  {program.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>