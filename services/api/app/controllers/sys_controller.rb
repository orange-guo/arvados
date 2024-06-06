# Copyright (C) The Arvados Authors. All rights reserved.
#
# SPDX-License-Identifier: AGPL-3.0

class SysController < ApplicationController
  skip_before_action :find_object_by_uuid
  skip_before_action :render_404_if_no_object
  before_action :admin_required

  def trash_sweep
    act_as_system_user do
      # Sweep trashed collections
      Collection.
        where('delete_at is not null and delete_at < statement_timestamp()').
        in_batches(of: 15).
        destroy_all
      Collection.
        where('is_trashed = false and trash_at < statement_timestamp()').
        in_batches(of: 15).
        update_all('is_trashed = true')

      # Want to make sure the #update_trash hook on the Group class
      # runs.  It does a couple of important things:
      #
      # - For projects, puts all the subprojects in the trashed_groups table.
      #
      # - For role groups, starting from #20943, when a role group
      # enters the trash it keeps its members but loses its outbound
      # permissions.
      Group.
        where("is_trashed = false and trash_at < statement_timestamp()").each do |grp|
        grp.is_trashed = true
        grp.save
      end

      # Sweep groups and their contents that are ready to be deleted
      Group.
        where('delete_at is not null and delete_at < statement_timestamp()').each do |group|
          delete_project_and_contents(group.uuid)
      end

      # Sweep expired tokens
      ActiveRecord::Base.connection.execute("DELETE from api_client_authorizations where expires_at <= statement_timestamp()")
    end
    head :no_content
  end

  protected

  def delete_project_and_contents(p_uuid)
    p = Group.find_by_uuid(p_uuid)
    if !p
      raise "can't sweep group '#{p_uuid}', it may not exist"
    end
    # First delete sub projects
    Group.where({group_class: 'project', owner_uuid: p_uuid}).each do |sub_project|
      delete_project_and_contents(sub_project.uuid)
    end
    # Next, iterate over all tables which have owner_uuid fields, with some
    # exceptions, and delete records owned by this project
    skipped_classes = ['Group', 'User']
    ActiveRecord::Base.descendants.reject(&:abstract_class?).each do |klass|
      if !skipped_classes.include?(klass.name) && klass.columns.collect(&:name).include?('owner_uuid')
        klass.where({owner_uuid: p_uuid}).in_batches(of: 15).destroy_all
      end
    end
    # Finally delete the project itself
    p.destroy
  end
end
