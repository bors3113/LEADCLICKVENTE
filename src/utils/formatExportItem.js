function formatItemForExport(item) {
  const formattedItem = { ...item };

  if (item.contactInfo) {
    formattedItem.emails = item.contactInfo.emails ? item.contactInfo.emails.join(', ') : '';

    if (item.contactInfo.socialMedia) {
      Object.entries(item.contactInfo.socialMedia).forEach(([platform, links]) => {
        formattedItem[`${platform}_links`] = links && links.length > 0 ? links.join(', ') : '';
      });
    }

    delete formattedItem.contactInfo;
  }

  return formattedItem;
}

module.exports = { formatItemForExport };
